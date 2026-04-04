#!/usr/bin/env node
// Auto-verify and save all transactions with preimage proofs
// Usage: NWC_URL="..." node auto_ledger.js
// Runs as background process, watches for payments, verifies and saves proofs

const { NWCClient } = require("@getalby/sdk/nwc");
const { getFiatValue } = require("@getalby/lightning-tools/fiat");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const NWC_URL = process.env.NWC_URL;

// Force stdout unbuffered for background process visibility
const origLog = console.log;
console.log = (...args) => { origLog(...args); process.stdout.write("\n"); };
const LEDGER_DIR = path.join(process.env.HOME, ".hermes", "ledgers");
const LEDGER_FILE = path.join(LEDGER_DIR, "transactions_ledger.json");
const PROOFS_DIR = path.join(LEDGER_DIR, "proofs");

// Ensure directories exist
if (!fs.existsSync(LEDGER_DIR)) fs.mkdirSync(LEDGER_DIR, { recursive: true });
if (!fs.existsSync(PROOFS_DIR)) fs.mkdirSync(PROOFS_DIR, { recursive: true });

// Load existing ledger
let ledger = [];
if (fs.existsSync(LEDGER_FILE)) {
  try {
    ledger = JSON.parse(fs.readFileSync(LEDGER_FILE, "utf8"));
  } catch (e) {
    ledger = [];
  }
}

console.log(`📖 Ledger loaded: ${ledger.length} existing transactions`);
console.log(`💾 Saving to: ${LEDGER_FILE}`);
console.log(`📁 Proofs directory: ${PROOFS_DIR}`);

async function verifyPreimage(tx) {
  if (!tx.preimage) return { valid: false, reason: "No preimage available" };
  const expected = tx.payment_hash;
  const computed = crypto.createHash("sha256").update(Buffer.from(tx.preimage, "hex")).digest("hex");
  return { valid: computed === expected, preimage: tx.preimage, computed_hash: computed, expected_hash: expected };
}

async function getFiatUsd(sats) {
  try {
    const rate = await getFiatValue({ satoshi: 1, currency: "USD" });
    return { rate, usd: (sats * rate).toFixed(4) };
  } catch {
    return { rate: null, usd: null };
  }
}

async function processTransaction(tx) {
  // Skip if already in ledger (deduplication)
  if (ledger.find(l => l.payment_hash === tx.payment_hash)) {
    console.log(`⏭️  Duplicate skipped: ${tx.payment_hash.substring(0, 12)}...`);
    return null;
  }

  // Only process settled transactions
  if (tx.state !== "settled") {
    console.log(`⏳ Pending: ${tx.payment_hash.substring(0, 12)}... (state: ${tx.state})`);
    return null;
  }

  const sats = tx.amount / 1000;
  const { usd } = await getFiatUsd(sats);

  // Verify preimage
  const verification = await verifyPreimage(tx);

  const record = {
    type: tx.type,
    state: tx.state,
    sats,
    usd: usd || "N/A",
    fees: tx.fees_paid / 1000,
    description: tx.description || "",
    payment_hash: tx.payment_hash,
    preimage: tx.preimage || null,
    crypto_proof: verification.valid
      ? { verified: true, preimage: tx.preimage, sha256_match: true }
      : { verified: false, reason: verification.reason },
    created_at: tx.created_at,
    settled_at: tx.settled_at,
    invoice: tx.invoice || "",
    verified_at: Date.now()
  };

  // Add to ledger
  ledger.push(record);

  // Save ledger
  fs.writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2));

  // Save individual proof file
  const timestamp = new Date(tx.settled_at * 1000).toISOString().replace(/[:.]/g, "-");
  const proofFile = path.join(PROOFS_DIR, `${tx.type}_${sats}sats_${timestamp}.json`);
  fs.writeFileSync(proofFile, JSON.stringify(record, null, 2));

  return record;
}

async function main() {
  if (!NWC_URL) {
    console.error("Error: NWC_URL environment variable not set");
    process.exit(1);
  }

  const client = new NWCClient({ nostrWalletConnectUrl: NWC_URL });
  console.log(`🔗 Connected to wallet: ${client.walletPubkey.substring(0, 16)}...`);

  // First, check for any recent transactions that might not have been processed
  console.log("📡 Scanning recent history...");
  const recent = await client.listTransactions({ limit: 50 });
  let processed = 0;
  for (const tx of recent.transactions) {
    const result = await processTransaction(tx);
    if (result) processed++;
  }
  console.log(`✅ Processed ${processed} new settlements from history`);
  console.log(`📊 Ledger total: ${ledger.length} transactions`);

  // Now subscribe to real-time notifications
  console.log("👀 Watching for new payments in real-time...");
  
  const unsub = await client.subscribeNotifications(
    async (notification) => {
      const tx = notification.notification;
      console.log(`\n🔔 ${notification.notification_type === "payment_received" ? "→ INCOMING" : notification.notification_type === "payment_sent" ? "← OUTGOING" : "🔒 HOLD"} | ${tx.amount / 1000} sats`);
      
      const result = await processTransaction(tx);
      if (result) {
        console.log(`✅ Verified & saved: ${result.sats} sats (${result.usd} USD) — ${result.crypto_proof.verified ? "CRYPTO PROOF ✅" : "NO PREIMAGE"}`);
      }
    },
    ["payment_received", "payment_sent", "hold_invoice_accepted"]
  );

  // Keep process alive
  console.log("\n🔄 Auto-verification active. Process will watch for payments until stopped.");
  console.log(`📖 View ledger: ${LEDGER_FILE}`);
  console.log(`📁 View proofs: ${PROOFS_DIR}`);
  console.log(`\nPress Ctrl+C to stop monitoring.\n`);

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n🛑 Stopping monitoring...");
    unsub();
    client.close();
    console.log(`✅ Final ledger count: ${ledger.length} transactions`);
    process.exit(0);
  });
}

main().catch(e => {
  console.error(`💥 Fatal error: ${e.message}`);
  process.exit(1);
});
