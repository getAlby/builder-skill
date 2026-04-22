#!/usr/bin/env node
// Reconciliation Engine — resolves the offline/timeout edge case
// Usage: NWC_URL="..." node reconcile.js [--dry-run] [--window=300]
//
// PROBLEM: If payInvoice() throws after the payment was routed on Lightning,
// the agent doesn't know it succeeded. It may retry → double-spend risk,
// the ledger is stale, and the budget counter is wrong.
//
// SOLUTION: Post-failure reconciliation against the node's source of truth.
// 1. Scan node transaction history for the reconciliation window
// 2. Compare what the node says vs what the ledger says
// 3. Flag gaps, backfill missing entries, detect potential double-spends
// 4. Update pending counters for in-flight payments

const { NWCClient } = require("@getalby/sdk/nwc");
const { getFiatValue } = require("@getalby/lightning-tools/fiat");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const NWC_URL = process.env.NWC_URL;
const LEDGER_DIR = path.join(process.env.HOME, ".hermes", "ledgers");
const LEDGER_FILE = path.join(LEDGER_DIR, "transactions_ledger.json");
const PENDING_FILE = path.join(LEDGER_DIR, "pending_payments.json");
const RECON_LOG = path.join(LEDGER_DIR, "reconciliation_log.json");

// Ensure directories
if (!fs.existsSync(LEDGER_DIR)) fs.mkdirSync(LEDGER_DIR, { recursive: true });

function loadJson(filepath, fallback = []) {
  if (fs.existsSync(filepath)) {
    try { return JSON.parse(fs.readFileSync(filepath, "utf8")); }
    catch { return typeof fallback === "function" ? fallback() : fallback; }
  }
  return typeof fallback === "function" ? fallback() : fallback;
}

function saveJson(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

async function getFiatUsd(sats) {
  try {
    const rate = await getFiatValue({ satoshi: 1, currency: "USD" });
    return (sats * rate).toFixed(4);
  } catch { return "N/A"; }
}

function verifyPreimage(preimage, paymentHash) {
  if (!preimage) return false;
  const computed = crypto.createHash("sha256").update(Buffer.from(preimage, "hex")).digest("hex");
  return computed === paymentHash;
}

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const windowArg = args.find(a => a.startsWith("--window="));
const RECON_WINDOW_SEC = windowArg ? parseInt(windowArg.split("=")[1]) : 600; // 10 min default

async function main() {
  if (!NWC_URL) {
    console.error("Error: NWC_URL not set");
    process.exit(1);
  }

  const client = new NWCClient({ nostrWalletConnectUrl: NWC_URL });
  const info = await client.getInfo();
  console.log(`🔗 Connected: ${info.alias || "NWC wallet"}`);

  // Load current state
  const ledger = loadJson(LEDGER_FILE, []);
  const pending = loadJson(PENDING_FILE, { payments: [] }).payments;
  const reconciliationLog = loadJson(RECON_LOG, []);

  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - RECON_WINDOW_SEC;

  console.log(`\n🔍 Reconciliation window: last ${RECON_WINDOW_SEC}s`);
  console.log(`   Ledger entries:    ${ledger.length}`);
  console.log(`   Pending payments:  ${pending.length}`);
  console.log(`   Window start:      ${new Date(windowStart * 1000).toISOString()}`);
  console.log(`   Window end:        ${new Date(now * 1000).toISOString()}`);
  console.log("");

  // Step 1: Fetch node's transaction history for the window
  console.log("📡 Fetching transaction history from node...");
  let nodeTxs = [];
  try {
    const txs = await client.listTransactions({ from: windowStart, limit: 500 });
    nodeTxs = txs.transactions || [];
    console.log(`   Found ${nodeTxs.length} transactions in window`);
  } catch (err) {
    console.error(`   ❌ Failed to fetch transactions: ${err.message}`);
    client.close();
    process.exit(1);
  }

  // Build lookup sets
  const nodeHashes = new Set(nodeTxs.map(t => t.payment_hash));
  const nodeHashmap = new Map(nodeTxs.map(t => [t.payment_hash, t]));
  const ledgerHashes = new Set(ledger.map(l => l.payment_hash));
  const pendingHashes = new Set(pending.map(p => p.payment_hash));

  // Step 2: Reconcile — what the node has that the ledger doesn't
  console.log("\n📊 Reconciliation Results");
  console.log("═".repeat(60));

  const results = {
    timestamp: new Date().toISOString(),
    window_start: windowStart,
    window_end: now,
    window_sec: RECON_WINDOW_SEC,
    node_transactions: nodeTxs.length,
    ledger_entries: ledger.length,
    pending_count: pending.length,
    backfilled: [],
    resolved_pending: [],
    stale_pending: [],
    double_spend_risk: [],
    discrepancies: [],
  };

  // 2a: Node settled txs missing from ledger → backfill
  const missingFromLedger = nodeTxs.filter(t =>
    t.state === "settled" && !ledgerHashes.has(t.payment_hash)
  );

  if (missingFromLedger.length === 0) {
    console.log("✅ Ledger is in sync with node (no missing settled txs)");
  } else {
    console.log(`\n⚠️  ${missingFromLedger.length} settled transaction(s) on node but NOT in ledger:`);
    for (const tx of missingFromLedger) {
      const sats = tx.amount / 1000;
      const usd = await getFiatUsd(sats);
      const preimageValid = verifyPreimage(tx.preimage, tx.payment_hash);
      const dir = tx.type === "incoming" ? "→ IN" : "← OUT";
      console.log(`   ${dir} ${sats.toLocaleString()} sats (~$${usd}) — ${tx.description || "no memo"} — ${preimageValid ? "✅ preimage" : "⚠️ no preimage"}`);

      const record = {
        type: tx.type,
        state: "settled",
        sats,
        usd: usd || "N/A",
        fees: (tx.fees_paid || 0) / 1000,
        description: tx.description || "",
        payment_hash: tx.payment_hash,
        preimage: tx.preimage || null,
        crypto_proof: tx.preimage
          ? { verified: preimageValid, preimage: tx.preimage, sha256_match: preimageValid }
          : { verified: false, reason: "No preimage available" },
        created_at: tx.created_at,
        settled_at: tx.settled_at,
        invoice: tx.invoice || "",
        verified_at: Date.now(),
        backfilled_by: "reconciliation",
        backfilled_at: new Date().toISOString(),
      };

      if (!dryRun) {
        ledger.push(record);
      }
      results.backfilled.push({
        payment_hash: tx.payment_hash,
        sats,
        type: tx.type,
        description: tx.description || "",
      });
    }

    // Save updated ledger
    if (!dryRun && missingFromLedger.length > 0) {
      saveJson(LEDGER_FILE, ledger);
      console.log(`\n💾 Ledger updated: ${missingFromLedger.length} entries backfilled`);
    }
  }

  // 2b: Check pending payments against node
  console.log("\n🔄 Checking pending payments...");
  const resolved = [];
  const stillPending = [];
  const stale = [];

  for (const p of pending) {
    const nodeTx = nodeHashmap.get(p.payment_hash);

    if (nodeTx && nodeTx.state === "settled") {
      // Payment settled on node — resolve pending
      resolved.push({ ...p, resolved_as: "settled", node_settled_at: nodeTx.settled_at });
      console.log(`   ✅ ${p.payment_hash.substring(0, 16)}... SETTLED on node at ${new Date(nodeTx.settled_at * 1000).toISOString()}`);
    } else if (nodeTx && (nodeTx.state === "pending" || nodeTx.state === "in-flight")) {
      // Still pending on node — keep in pending list
      stillPending.push(p);
      console.log(`   ⏳ ${p.payment_hash.substring(0, 16)}... still IN-FLIGHT`);
    } else {
      // Not found on node — either failed, or outside lookup window
      const ageSeconds = now - (p.timestamp || 0);
      const maxPendingSec = Math.max(RECON_WINDOW_SEC, 3600); // 1 hour max

      if (ageSeconds > maxPendingSec) {
        stale.push({ ...p, resolved_as: "stale_expired", age_sec: ageSeconds });
        console.log(`   ❌ ${p.payment_hash.substring(0, 16)}... STALE (${Math.round(ageSeconds / 60)}min old, not on node)`);
      } else {
        stillPending.push(p);
        console.log(`   🕐 ${p.payment_hash.substring(0, 16)}... young pending (${Math.round(ageSeconds)}s), keeping`);
      }
    }
  }

  results.resolved_pending = resolved;
  results.stale_pending = stale;

  // 2c: Double-spend risk detection
  // If the node shows 2+ outgoing payments with the same invoice/payment_request
  const outgoingByInvoice = new Map();
  for (const tx of nodeTxs.filter(t => t.type === "outgoing")) {
    if (!tx.invoice) continue;
    if (!outgoingByInvoice.has(tx.invoice)) outgoingByInvoice.set(tx.invoice, []);
    outgoingByInvoice.get(tx.invoice).push(tx);
  }

  for (const [invoice, txs] of outgoingByInvoice) {
    if (txs.length > 1) {
      const totalPaid = txs.reduce((sum, t) => sum + t.amount / 1000, 0);
      results.double_spend_risk.push({
        invoice: invoice.substring(0, 50) + "...",
        count: txs.length,
        total_sats: totalPaid,
        payment_hashes: txs.map(t => t.payment_hash),
      });
      console.log(`\n🚨 DOUBLE-SPEND DETECTED: invoice paid ${txs.length}x (${totalPaid}sats total)`);
    }
  }

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("📋 SUMMARY");
  console.log("─".repeat(60));
  console.log(`   Ledger entries:      ${ledger.length}`);
  console.log(`   Backfilled:          ${results.backfilled.length}`);
  console.log(`   Pending resolved:    ${resolved.length}`);
  console.log(`   Pending stale:       ${stale.length}`);
  console.log(`   Still pending:       ${stillPending.length}`);
  console.log(`   Double-spend risks:  ${results.double_spend_risk.length}`);
  console.log(`   Dry run:             ${dryRun ? "Yes (no changes written)" : "No"}`);

  // Save reconciliation log
  if (!dryRun) {
    reconciliationLog.push(results);
    saveJson(RECON_LOG, reconciliationLog);

    // Update pending payments
    const newPending = [...stillPending];
    saveJson(PENDING_FILE, { payments: newPending, last_reconciled: new Date().toISOString() });

    console.log(`\n💾 Reconciliation log saved`);
    console.log(`💾 Pending updated: ${newPending.length} remaining`);
  }

  client.close();
}

main().catch(e => {
  console.error(`💥 Fatal: ${e.message}`);
  process.exit(1);
});
