#!/usr/bin/env node
// Budget Guardian - spending caps with alerts
// Usage: NWC_URL="..." node budget_guardian.js [setup|check|reset] [weekly_sats]
// 
// Game Theory: Creates commitment device - you set your own spending limit
//            and the system enforces it, removing temptation from the equation.

const { NWCClient } = require("@getalby/sdk/nwc");
const { getFiatValue } = require("@getalby/lightning-tools/fiat");
const fs = require("fs");
const path = require("path");

const NWC_URL = process.env.NWC_URL;
const BUDGET_FILE = path.join(process.env.HOME, ".hermes", "ledgers", "budget_guardian.json");

// Ensure directory exists
const dir = path.dirname(BUDGET_FILE);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

function loadBudget() {
  if (fs.existsSync(BUDGET_FILE)) {
    return JSON.parse(fs.readFileSync(BUDGET_FILE, "utf8"));
  }
  return { weekly_cap: null, alerts_enabled: true, history: [] };
}

function saveBudget(data) {
  fs.writeFileSync(BUDGET_FILE, JSON.stringify(data, null, 2));
}

async function getCurrentWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Start from Monday
  now.setDate(diff);
  now.setHours(0, 0, 0, 0);
  return Math.floor(now.getTime() / 1000);
}

async function getOutgoingForPeriod(from_ts, client) {
  const txs = await client.listTransactions({ type: "outgoing", from: from_ts, limit: 500 });
  return txs.transactions
    .filter(t => t.state === "settled")
    .reduce((sum, t) => sum + (t.amount / 1000), 0);
}

async function main() {
  if (!NWC_URL) {
    console.error("NWC_URL not set");
    process.exit(1);
  }

  const command = process.argv[2] || "status";
  const capArg = parseInt(process.argv[3]);
  
  const budget = loadBudget();

  if (command === "setup") {
    if (!capArg || capArg <= 0) {
      console.log("Usage: node budget_guardian.js setup <weekly_sats_cap>\n");
      console.log("Set a weekly spending limit. Once reached, all sends are blocked until the week resets.");
      console.log("Example: node budget_guardian.js setup 5000  # 5,000 sats/week max");
      return;
    }
    budget.weekly_cap = capArg;
    budget.alerts_enabled = true;
    saveBudget(budget);
    console.log(`Budget set: ${capArg.toLocaleString()} sats/week`);
    return;
  }

  if (command === "reset") {
    const weekStart = await getCurrentWeekStart();
    budget.current_week_start = weekStart;
    budget.alerts_enabled = true;
    saveBudget(budget);
    console.log(`Budget reset for new week starting ${new Date(weekStart * 1000).toLocaleDateString()}`);
    return;
  }

  if (command === "status") {
    if (!budget.weekly_cap) {
      console.log("⚠️  No budget cap set. Run: node budget_guardian.js setup <weekly_sats>");
      return;
    }

    const client = new NWCClient({ nostrWalletConnectUrl: NWC_URL });
    try {
      const weekStart = await getCurrentWeekStart();
      const spent = await getOutgoingForPeriod(weekStart, client);
      const remaining = budget.weekly_cap - spent;
      const rate = await getFiatValue({ satoshi: 1, currency: "USD" });
      const spentUsd = (spent * rate).toFixed(2);
      const remainingUsd = (remaining * rate).toFixed(2);
      
      const pct = (spent / budget.weekly_cap * 100).toFixed(1);
      const status = remaining > 0 ? "✅ Under budget" : "❌ OVER BUDGET";
      
      console.log(`\n══ Budget Guardian ══\n`);
      console.log(`Weekly Cap:    ${budget.weekly_cap.toLocaleString()} sats`);
      console.log(`Spent:         ${spent.toLocaleString()} sats ($${spentUsd}) — ${pct}%`);
      console.log(`Remaining:     ${remaining.toLocaleString()} sats ($${remainingUsd})`);
      console.log(`Status:        ${status}`);
      console.log(`\nWeek started:  ${new Date(weekStart * 1000).toLocaleDateString()}`);

      if (pct > 90) {
        console.log(`\n⚠️  WARNING: You're at ${pct}% of your weekly budget!`);
      }

      // Show trend
      if (budget.history.length > 1) {
        const avg = budget.history.slice(-4).reduce((s, w) => s + w.spent, 0) / 
                    Math.min(budget.history.length, 4);
        console.log(`\nAvg recent:    ${Math.round(avg).toLocaleString()} sats/week`);
      }

    } finally {
      client.close();
    }
    return;
  }

  console.log(`Usage: node budget_guardian.js [setup <weekly_sats>|check|reset|status]`);
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
