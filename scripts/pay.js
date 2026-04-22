#!/usr/bin/env node
// Pay sats with safety, budget enforcement, pending tracking, and auto-reconciliation
// Usage: NWC_URL="..." node pay.js <amount_sats> <recipient_or_invoice>
//
// Safety features:
//  1. Budget check with rolling window + pending counter
//  2. Pre-decode & preview before sending
//  3. Pending register (treats in-flight as already-spent)
//  4. Post-send verification with preimage proof
//  5. Timeout reconciliation (resolves the double-spend gap)

const { NWCClient } = require("@getalby/sdk/nwc");
const { LightningAddress } = require("@getalby/lightning-tools");
const { decode: decodeBolt11 } = require("light-bolt11-decoder");
const { getFiatValue } = require("@getalby/lightning-tools/fiat");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const NWC_URL = process.env.NWC_URL;

// Paths — shared with reconcile.js and budget_guardian.js
const LEDGER_DIR = path.join(process.env.HOME, ".hermes", "ledgers");
const LEDGER_FILE = path.join(LEDGER_DIR, "transactions_ledger.json");
const PENDING_FILE = path.join(LEDGER_DIR, "pending_payments.json");
const BUDGET_FILE = path.join(LEDGER_DIR, "budget_guardian.json");

if (!fs.existsSync(LEDGER_DIR)) fs.mkdirSync(LEDGER_DIR, { recursive: true });

function loadJson(filepath, fallback = {}) {
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
    return { rate, usd: (sats * rate).toFixed(4) };
  } catch {
    return { rate: null, usd: "N/A" };
  }
}

// ── Budget + Pending Counter Check ──────────────────────────────────
// Rolling window: checks last N minutes (default 60) instead of just calendar week
// Pending counter: treats in-flight payments as already-spent
async function checkBudget(client, amountSats) {
  const budget = loadJson(BUDGET_FILE, {});
  if (!budget.weekly_cap) return { ok: true, reason: "No budget configured" };

  const now = Math.floor(Date.now() / 1000);

  // Rolling window (default 1 hour, can be configured)
  const rollingWindow = budget.rolling_window_sec || 3600;
  const windowStart = now - rollingWindow;

  // Get actual settled spend from node
  const windowTx = await client.listTransactions({
    type: "outgoing",
    from: windowStart,
    limit: 500,
  });
  const settledInWindow = (windowTx.transactions || [])
    .filter(t => t.state === "settled")
    .reduce((sum, t) => sum + t.amount / 1000, 0);

  // Add in-flight pending payments
  const pending = loadJson(PENDING_FILE, { payments: [] }).payments;
  // Clean up stale pending (> rolling window old)
  const freshPending = pending.filter(p => (now - p.timestamp) < rollingWindow);
  const pendingTotal = freshPending.reduce((sum, p) => sum + p.sats, 0);

  const effectiveSpent = settledInWindow + pendingTotal;
  const effectiveRemaining = budget.weekly_cap - effectiveSpent;

  return {
    ok: (effectiveSpent + amountSats) <= budget.weekly_cap,
    cap: budget.weekly_cap,
    settled_in_window: settledInWindow,
    pending_total: pendingTotal,
    pending_count: freshPending.length,
    effective_spent: effectiveSpent,
    effective_remaining: effectiveRemaining,
    rolling_window_min: Math.round(rollingWindow / 60),
    reason: (effectiveSpent + amountSats) > budget.weekly_cap
      ? `Budget exceeded: ${effectiveSpent} settled + ${pendingTotal} pending + ${amountSats} requested = ${effectiveSpent + pendingTotal + amountSats} > ${budget.weekly_cap} cap (${Math.round(rollingWindow/60)}min rolling window)`
      : "Within budget",
  };
}

// Register a pending payment (before sending)
function registerPending(paymentHash, sats, invoice, description) {
  const pendingFile = loadJson(PENDING_FILE, { payments: [] });
  pendingFile.payments.push({
    payment_hash: paymentHash,
    sats,
    invoice: invoice ? invoice.substring(0, 80) : "",
    description: description || "",
    timestamp: Math.floor(Date.now() / 1000),
  });
  saveJson(PENDING_FILE, pendingFile);
}

// Clear pending after settlement
function clearPending(paymentHash) {
  const pendingFile = loadJson(PENDING_FILE, { payments: [] });
  pendingFile.payments = pendingFile.payments.filter(p => p.payment_hash !== paymentHash);
  saveJson(PENDING_FILE, pendingFile);
}

// ── Payment Flow ────────────────────────────────────────────────────
async function main() {
  if (!NWC_URL) {
    console.error("Error: NWC_URL not set");
    process.exit(1);
  }

  const amountArg = parseInt(process.argv[2]);
  const recipient = process.argv[3] || "";

  if (!amountArg || amountArg <= 0 || !recipient) {
    console.log("Usage: node pay.js <amount_sats> <recipient_or_invoice>");
    console.log("\n  Recipient can be:");
    console.log("    • Lightning address: user@domain.com");
    console.log("    • BOLT-11 invoice:   lnbc1...");
    console.log("\n  Safety: Budget is checked before sending. In-flight payments count against the cap.");
    return;
  }

  const client = new NWCClient({ nostrWalletConnectUrl: NWC_URL });

  try {
    // 1. Get invoice
    let bolt11;
    let description = "";
    let paymentHash;

    if (recipient.toLowerCase().includes("@")) {
      // Lightning address
      const ln = new LightningAddress(recipient);
      await ln.fetch();
      const inv = await ln.requestInvoice({ satoshi: amountArg });
      bolt11 = inv.paymentRequest;
      decoded = decodeBolt11(bolt11);
      paymentHash = decoded.sections.find(s => s.name === "payment_hash")?.value;
      description = decoded.sections.find(s => s.name === "description")?.value || "";
    } else {
      // Raw BOLT-11 invoice
      bolt11 = recipient;
      const decoded = decodeBolt11(bolt11);
      paymentHash = decoded.sections.find(s => s.name === "payment_hash")?.value;
      description = decoded.sections.find(s => s.name === "description")?.value || "";
      // Override amount from invoice if needed
    }

    const { usd } = await getFiatUsd(amountArg);

    // 2. Budget check
    const budgetCheck = await checkBudget(client, amountArg);
    console.log(`\n💰 Payment Preview`);
    console.log(`─────────────────────────`);
    console.log(`  Amount:    ${amountArg.toLocaleString()} sats (~$${usd})`);
    console.log(`  To:        ${recipient}`);
    console.log(`  Memo:      ${description || "—"}`);
    console.log(`  Payment:   ${paymentHash?.substring(0, 16)}...`);
    console.log(`\n🛡️  Budget Guardian`);
    console.log(`─────────────────────────`);
    if (budgetCheck.ok) {
      console.log(`  ✅ Budget OK: ${budgetCheck.effective_remaining} sats remaining`);
      console.log(`     (Rolling ${budgetCheck.rolling_window_min}min window, ${budgetCheck.pending_count} pending)`);
    } else {
      console.log(`  ❌ ${budgetCheck.reason}`);
      client.close();
      process.exit(1);
    }

    // 3. Register pending (prevents double-spend if we crash mid-flight)
    registerPending(paymentHash, amountArg, bolt11, description);

    // 4. Pay
    console.log(`\n⚡ Sending...`);
    let result;
    try {
      result = await client.payInvoice({ invoice: bolt11 });
    } catch (payErr) {
      // TIMEOUT / NETWORK ERROR PATH → trigger reconciliation
      console.log(`\n⚠️  Send error: ${payErr.message}`);
      console.log(`🔍 Running post-failure reconciliation...`);

      // Brief wait for propagation
      await new Promise(r => setTimeout(r, 5000));

      try {
        const txs = await client.listTransactions({ limit: 20 });
        const nodeTx = txs.transactions.find(t => t.payment_hash === paymentHash);

        if (nodeTx && nodeTx.state === "settled") {
          result = { preimage: nodeTx.preimage, fees_paid: nodeTx.fees_paid };
          console.log(`✅ Payment was DELIVERED (confirmed via node reconciliation)`);
        } else if (nodeTx && (nodeTx.state === "pending" || nodeTx.state === "in-flight")) {
          console.log(`⏳ Payment is IN-FLIGHT on node. Will resolve on next reconciliation.`);
          console.log(`   Pending counter is already active — budget is protected.`);
          client.close();
          process.exit(2); // special exit: in-flight
        } else {
          // Not on node → payment likely never went through, safe to retry
          // Clear the pending entry
          clearPending(paymentHash);
          console.log(`❌ Payment NOT found on node. Safe to retry.`);
          client.close();
          process.exit(3); // special exit: failed, safe to retry
        }
      } catch (reconErr) {
        console.log(`⚠️  Reconciliation also failed: ${reconErr.message}`);
        console.log(`   Pending counter remains active. Check node manually.`);
        client.close();
        process.exit(4);
      }
    }

    // 5. Clear pending & verify preimage
    clearPending(paymentHash);
    const preimageHex = result.preimage;
    const preimageBytes = Buffer.from(preimageHex, "hex");
    const computedHash = crypto.createHash("sha256").update(preimageBytes).digest("hex");

    const valid = computedHash === paymentHash;
    const feesSats = result.fees_paid / 1000;

    // 6. Output for agent pipeline
    console.log(`\n✅ Payment confirmed!`);
    console.log(`─────────────────────────`);
    console.log(`  Preimage:  ${preimageHex}`);
    console.log(`  Fees:      ${feesSats} sats`);
    console.log(`  Verified:  ${valid ? "CRYPTO PROOF ✅" : "⚠️ Preimage mismatch"}`);

    // Also output machine-readable format
    console.log(`\nSATS=${amountArg}`);
    console.log(`FEES=${feesSats}`);
    console.log(`PREIMAGE=${preimageHex}`);
    console.log(`VALID=${valid}`);
    console.log(`PAYMENT_HASH=${paymentHash}`);

  } finally {
    client.close();
  }
}

main().catch(e => {
  console.error(`💥 Fatal: ${e.message}`);
  process.exit(1);
});
