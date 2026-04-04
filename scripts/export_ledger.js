#!/usr/bin/env node
// Export ledger to CSV or summary view
// Usage: NWC_URL="..." node export_ledger.js [csv|summary|json] [days]

const fs = require("fs");
const path = require("path");

const LEDGER_FILE = path.join(process.env.HOME, ".hermes", "ledgers", "transactions_ledger.json");
const format = (process.argv[2] || "summary").toLowerCase();
const days = parseInt(process.argv[3]) || null;

if (!fs.existsSync(LEDGER_FILE)) {
  console.error("Ledger not found. Start auto_ledger.js first.");
  process.exit(1);
}

let ledger = JSON.parse(fs.readFileSync(LEDGER_FILE, "utf8"));

// Filter by days if provided
if (days) {
  const cutoff = Date.now() - (days * 86400000);
  ledger = ledger.filter(t => t.verified_at >= cutoff);
}

if (ledger.length === 0) {
  console.log("No transactions found for this period.");
  process.exit(0);
}

// Sort by settled_at
ledger.sort((a, b) => a.settled_at - b.settled_at);

if (format === "csv") {
  // Generate CSV
  const header = "Date,Type,Amount(sats),Amount(USD),Fees(sats),Description,PaymentHash,Preimage,Verified";
  const rows = ledger.map(t => {
    const d = new Date(t.settled_at * 1000).toISOString().split("T")[0];
    return `${d},${t.type},${t.sats},${t.usd},${t.fees},"${(t.description || "").replace(/"/g, '""')}",${t.payment_hash},${t.preimage || ""},${t.crypto_proof?.verified || false}`;
  });
  console.log([header, ...rows].join("\n"));

  // Save to file
  const csvPath = path.join(process.env.HOME, ".hermes", "ledgers", `ledger_export_${Date.now()}.csv`);
  fs.writeFileSync(csvPath, [header, ...rows].join("\n"));
  console.log(`\nSaved: ${csvPath}`);

} else if (format === "summary") {
  const totalIn = ledger.filter(t => t.type === "incoming").reduce((s, t) => s + t.sats, 0);
  const totalOut = ledger.filter(t => t.type === "outgoing").reduce((s, t) => s + t.sats, 0);
  const totalFees = ledger.reduce((s, t) => s + t.fees, 0);
  const verified = ledger.filter(t => t.crypto_proof?.verified).length;
  const net = totalIn - totalOut;

  console.log(`══ Ledger Summary ${days ? `(${days}d)` : ""} ══`);
  console.log(``);
  console.log(`Total:       ${ledger.length} transactions (${verified} verified)`);
  console.log(`→ Incoming:  +${totalIn} sats`);
  console.log(`← Outgoing:  -${totalOut} sats`);
  console.log(`⚡ Fees paid: ${totalFees} sats`);
  console.log(`Net flow:    ${net >= 0 ? "+" : ""}${net} sats (${net >= 0 ? "surplus" : "deficit"})`);
  console.log(`First:       ${new Date(ledger[0].settled_at * 1000).toLocaleDateString()}`);
  console.log(`Last:        ${new Date(ledger[ledger.length-1].settled_at * 1000).toLocaleDateString()}`);
  console.log(`Verified:    ${verified}/${ledger.length} (${((verified/ledger.length)*100).toFixed(1)}%)`);

} else if (format === "json") {
  console.log(JSON.stringify(ledger, null, 2));
}
