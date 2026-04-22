#!/usr/bin/env node
// Wallet Summary — one command, complete picture
// Usage: NWC_URL="..." node summary.js

const { NWCClient } = require("@getalby/sdk/nwc");
const { getFiatValue } = require("@getalby/lightning-tools/fiat");
const fs = require("fs");
const path = require("path");

const NWC_URL = process.env.NWC_URL;
const LEDGER_FILE = path.join(process.env.HOME, ".hermes", "ledgers", "transactions_ledger.json");
const BUDGET_FILE = path.join(process.env.HOME, ".hermes", "ledgers", "budget_guardian.json");

async function main() {
  if (!NWC_URL) {
    console.error("NWC_URL not set");
    process.exit(1);
  }

  const client = new NWCClient({ nostrWalletConnectUrl: NWC_URL });
  
  try {
    const [balance, info, txs] = await Promise.all([
      client.getBalance(),
      client.getInfo().catch(() => ({ alias: "NWC", network: "mainnet", methods: ["get_balance"] })),
      client.listTransactions({ limit: 20 })
    ]);

    const settled = (txs.transactions || []).filter(t => t.state === "settled");
    const sats = balance.balance / 1000;
    const incoming = settled.filter(t => t.type === "incoming");
    const outgoing = settled.filter(t => t.type === "outgoing");
    const totalIn = incoming.reduce((s, t) => s + t.amount / 1000, 0);
    const totalOut = outgoing.reduce((s, t) => s + t.amount / 1000, 0);

    // Read ledger for crypto proof status
    let verifiedCount = 0;
    let ledgerTotal = 0;
    let history = [];
    if (fs.existsSync(LEDGER_FILE)) {
      const ledger = JSON.parse(fs.readFileSync(LEDGER_FILE, "utf8"));
      ledgerTotal = ledger.length;
      verifiedCount = ledger.filter(t => t.crypto_proof?.verified).length;
      history = ledger;
    }

    // Read budget if exists
    let budget = null;
    if (fs.existsSync(BUDGET_FILE)) {
      const b = JSON.parse(fs.readFileSync(BUDGET_FILE, "utf8"));
      if (b.weekly_cap) {
        const spent = outgoing.filter(t => t.settled_at >= Math.floor(Date.now() / 1000 - 7 * 86400))
          .reduce((s, t) => s + t.amount / 1000, 0);
        budget = { cap: b.weekly_cap, spent, pct: Math.round(spent / b.weekly_cap * 100) };
      }
    }

    // Format output
    const lines = [];
    
    // Header
    lines.push(`╓─ ${(info.alias || 'WALLET').toUpperCase()} ───────────────────────────╖`);
    lines.push(`║                                     ║`);
    lines.push(`║`);
    
    // Balance - prominent
    if (sats > 0) {
      const rate = await getFiatValue({ satoshi: 1, currency: "USD" });
      lines.push(`║`);
      lines.push(`║    ·─────────────────────────────────`);
      lines.push(`║    ${sats.toLocaleString()} sats`);
      const usd = (sats * rate).toFixed(2);
      const eur = (sats * rate * 0.87).toFixed(2);
      const kes = Math.round(sats * rate * 130);
      lines.push(`║    ───────────────`);
      lines.push(`║    $${usd} USD  ·  €${eur} EUR  ·  KSh ${kes.toLocaleString()} KES`);
      lines.push(`║    ·─────────────────────────────────`);
    } else {
      lines.push(`║`);
      lines.push(`║    ·─────────────────────────────────`);
      lines.push(`║    0 sats  —  ready for funding`);
      lines.push(`║    ·─────────────────────────────────`);
    }
    
    lines.push(`║`);
    lines.push(`║    Flow`);
    lines.push(`║    → ${totalIn.toLocaleString()} in     ← ${totalOut.toLocaleString()} out`);
    lines.push(`║    ${verifiedCount}/${ledgerTotal} proven ✅`);
    lines.push(`║`);

    // Recent transactions
    const recent = history.slice(-3).reverse();
    if (recent.length > 0) {
      lines.push(`║    ·──────── Last transactions ────────`);
      for (const t of recent) {
        const arrow = t.type === "incoming" ? "→" : "←";
        const sign = t.type === "incoming" ? "+" : "-";
        const desc = t.description ? ` ${t.description}` : "";
        lines.push(`║    ${arrow} ${sign}${t.sats.toLocaleString()} sats  ✅${desc}`);
      }
    }
    
    // Budget
    if (budget) {
      lines.push(`║    ·──────── Budget ──────────────────`);
      const status = budget.pct < 90 ? "✅" : "⚠️";
      const bar = "█".repeat(Math.floor(budget.pct / 10)) + "░".repeat(10 - Math.floor(budget.pct / 10));
      lines.push(`║    ${status} ${budget.spent.toLocaleString()}/${budget.cap.toLocaleString()} sats  ${budget.pct}% │${bar}│`);
    }
    
    lines.push(`║`);
    lines.push(`╙─────────────────────────────────────────╜`);

    console.log(lines.join("\n"));
    
  } finally {
    client.close();
  }
}

main().catch(e => console.error(e.message));
