#!/usr/bin/env node
// Wallet health check — diagnostics
// Usage: NWC_URL="..." node health_check.js

const { NWCClient } = require("@getalby/sdk/nwc");
const { getFiatValue } = require("@getalby/lightning-tools/fiat");
const fs = require("fs");
const path = require("path");

const NWC_URL = process.env.NWC_URL;
const LEDGER_FILE = path.join(process.env.HOME, ".hermes", "ledgers", "transactions_ledger.json");

async function main() {
  if (!NWC_URL) {
    console.error("NWC_URL not set");
    process.exit(1);
  }

  const checks = [];
  const start = Date.now();

  const client = new NWCClient({ nostrWalletConnectUrl: NWC_URL });

  try {
    // 1. Connection
    checks.push("🔗 Connection: Checking...");
    const info = await client.getInfo();
    checks[0] = `🔗 Connection: ✅ ${info.alias} (${info.network})`;

    // 2. Methods
    const methods = info.methods || [];
    const canPay = methods.includes("pay_invoice");
    const canReceive = methods.includes("make_invoice");
    checks.push(`📤 Send: ${canPay ? "✅" : "❌"}  |  📥 Receive: ${canReceive ? "✅" : "❌"}`);

    // 3. Balance
    const balance = await client.getBalance();
    const sats = balance.balance / 1000;
    const rate = await getFiatValue({ satoshi: 1, currency: "USD" });
    const usd = (sats * rate).toFixed(4);
    checks.push(`💰 Balance: ${sats} sats (~$${usd} USD)`);

    // 4. Ledger
    let ledgerStatus = "⚠️  Not started";
    if (fs.existsSync(LEDGER_FILE)) {
      const ledger = JSON.parse(fs.readFileSync(LEDGER_FILE, "utf8"));
      if (ledger.length > 0) {
        const last = ledger[ledger.length - 1];
        const ago = Math.round((Date.now() - last.verified_at) / 60000);
        const verified = ledger.filter(t => t.crypto_proof?.verified).length;
        ledgerStatus = `✅ ${ledger.length} txns (${verified} verified), last: ${ago}m ago`;
      } else {
        ledgerStatus = "📭 Empty — no transactions yet";
      }
    }
    checks.push(`📖 Ledger: ${ledgerStatus}`);

    // 5. Last Activity
    if (fs.existsSync(LEDGER_FILE)) {
      const ledger = JSON.parse(fs.readFileSync(LEDGER_FILE, "utf8"));
      if (ledger.length > 0) {
        const last = ledger[ledger.length - 1];
        const d = new Date(last.settled_at * 1000);
        checks.push(`⏱️  Last activity: ${d.toLocaleString()} (${last.type}, ${last.sats} sats)`);
      }
    } else {
      checks.push("⏱️  Last activity: N/A");
    }

    // 6. Relay
    const relayUrls = client.options?.relayUrls || client.relayUrls || [];
    checks.push(`📡 Relays: ${relayUrls.map((u, i) => `[${i+1}] ${u}`).join(", ")}`);

    const elapsed = Date.now() - start;

    console.log(`══ Wallet Health Check (${elapsed}ms) ══`);
    console.log(``);
    checks.forEach(c => console.log(c));
    console.log(``);

    // Warnings
    const warnings = [];
    if (sats === 0) warnings.push("⚠️  Balance is zero — cannot send payments");
    if (!canPay) warnings.push("⚠️  No pay_invoice permission — NWC connection is read-only");
    if (!fs.existsSync(LEDGER_FILE)) warnings.push("⚠️  Ledger not set up — run auto_ledger.js to enable proofs");

    if (warnings.length) {
      console.log(`Warnings:`);
      warnings.forEach(w => console.log(`  ${w}`));
      console.log(``);
    } else {
      console.log(`✅ All checks passed`);
    }

  } finally {
    client.close();
  }
}

main().catch(e => {
  console.error(`💥 Check failed: ${e.message}`);
  process.exit(1);
});
