#!/usr/bin/env node
// Spending analytics and period reports
// Usage: NWC_URL="..." node analytics.js [days_back]
// Default: 30 days

const { NWCClient } = require("@getalby/sdk/nwc");
const { getFiatValue } = require("@getalby/lightning-tools/fiat");

const NWC_URL = process.env.NWC_URL;
const daysBack = parseInt(process.argv[2]) || 30;

async function main() {
  if (!NWC_URL) {
    console.error("Error: NWC_URL environment variable not set");
    process.exit(1);
  }

  const client = new NWCClient({ nostrWalletConnectUrl: NWC_URL });
  const until = Date.now() / 1000;
  const from = until - (daysBack * 86400);

  const [txs, rateUSD, info] = await Promise.all([
    client.listTransactions({ limit: 100, from: Math.floor(from), until: Math.ceil(until) }),
    getFiatValue({ satoshi: 1, currency: "USD" }).catch(() => 0),
    client.getInfo().catch(() => ({ alias: "Wallet" })),
  ]);

  const transactions = txs.transactions;
  
  if (transactions.length === 0) {
    console.log(`No transactions in the last ${daysBack} days.`);
    client.close();
    return;
  }

  let totalIn = 0, totalOut = 0, totalFees = 0;
  let settledCount = 0;
  const descriptions = {};

  for (const t of transactions) {
    if (t.state !== "settled") continue;
    settledCount++;
    const sats = t.amount / 1000;
    const fees = (t.fees_paid || 0) / 1000;
    
    if (t.type === "incoming") {
      totalIn += sats;
    } else {
      totalOut += sats;
    }
    totalFees += fees;

    // Track unique descriptions
    if (t.description) {
      const desc = t.description.substring(0, 30);
      if (!descriptions[desc]) descriptions[desc] = { in: 0, out: 0, count: 0 };
      if (t.type === "incoming") descriptions[desc].in += sats;
      else descriptions[desc].out += sats;
      descriptions[desc].count++;
    }
  }

  const net = totalIn - totalOut;
  const label1 = daysBack === 1 ? "Today" : daysBack === 7 ? "This Week" : daysBack === 30 ? "Last 30 Days" : `Last ${daysBack} Days`;

  console.log(`══ ${info.alias || "Wallet"} — ${label1} Report ══`);
  console.log(``);
  console.log(`Total: ${transactions.length} transactions (${settledCount} settled)`);
  console.log(``);
  console.log(`→ Incoming:  +${totalIn.toLocaleString()} sats (~$${(totalIn * rateUSD).toFixed(2)} USD)`);
  console.log(`← Outgoing:  -${totalOut.toLocaleString()} sats (~$${(totalOut * rateUSD).toFixed(2)} USD)`);
  console.log(`⚡ Fees paid:  ${totalFees.toLocaleString()} sats`);
  console.log(``);
  if (net >= 0) {
    console.log(`Net flow: +${net.toLocaleString()} sats (surplus)`);
  } else {
    console.log(`Net flow: ${net.toLocaleString()} sats (deficit)`);
  }
  
  if (totalIn > 0 || totalOut > 0) {
    console.log(``);
    console.log(`Top transactions:`);
    const sorted = [...transactions]
      .filter(t => t.state === "settled")
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    
    for (const t of sorted) {
      const sats = t.amount / 1000;
      const arrow = t.type === "incoming" ? "→" : "←";
      const desc = t.description ? t.description.substring(0, 25) : "(no description)";
      const date = new Date(t.created_at * 1000).toLocaleDateString();
      console.log(`  ${arrow} ${sats} sats | ${desc} | ${date}`);
    }
  }

  client.close();
}

main().catch(e => { console.error(e.message); });
