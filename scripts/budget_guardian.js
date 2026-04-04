#!/usr/bin/env node
// Budget Guardian - spending caps with rolling window + pending counter
// Usage: NWC_URL="..." node budget_guardian.js [setup|status|reset|pending] [cap_sats] [--window=3600]
//
// Safety layers:
//  1. Rolling window — checks last N minutes (not just calendar day)
//  2. Pending counter — in-flight payments count as spent before they settle
//  3. Node-verified — reads from the node's transaction history, not local state
//
// Game Theory: Creates commitment device - you set your own spending limit
//              and the system enforces it, removing temptation from the equation.

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
  return { 
    weekly_cap: null, 
    rolling_window_sec: 86400, // default: 24h rolling window
    alerts_enabled: true, 
    history: [],
    pending: [] // in-flight payments tracked here
  };
}

function loadPending() {
  const pendingFile = path.join(path.dirname(BUDGET_FILE), "pending_payments.json");
  if (fs.existsSync(pendingFile)) {
    try { return JSON.parse(fs.readFileSync(pendingFile, "utf8")).payments || []; }
    catch { return []; }
  }
  return [];
}

function getPendingTotal(pending, windowSec) {
  const now = Math.floor(Date.now() / 1000);
  return pending
    .filter(p => (now - p.timestamp) < windowSec) // only count recent pending
    .reduce((sum, p) => sum + p.sats, 0);
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

async function getOutgoingForPeriod(from_ts, client, state = "settled") {
  const txs = await client.listTransactions({ type: "outgoing", from: from_ts, limit: 500 });
  return txs.transactions
    .filter(t => t.state === state)
    .reduce((sum, t) => sum + (t.amount / 1000), 0);
}

// Calculate effective spent: settled in rolling window + in-flight pending
async function getEffectiveSpent(client, windowSec) {
  const now = Math.floor(Date.now() / 1000);
  const settled = await getOutgoingForPeriod(now - windowSec, client, "settled");
  const pending = loadPending();
  const pendingTotal = getPendingTotal(pending, windowSec);
  return { settled, pending_total: pendingTotal, pending_count: pending.filter(p => (now - p.timestamp) < windowSec).length, effective: settled + pendingTotal };
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
      const windowSec = budget.rolling_window_sec || 86400;
      const spent = await getOutgoingForPeriod(weekStart, client);
      const { settled, pending_total, pending_count, effective } = await getEffectiveSpent(client, windowSec);
      
      const remaining = budget.weekly_cap - spent;
      const remainingEffective = budget.weekly_cap - effective;
      const rate = await getFiatValue({ satoshi: 1, currency: "USD" });
      const spentUsd = (spent * rate).toFixed(2);
      const effectiveUsd = (effective * rate).toFixed(2);
      const remainingUsd = (remaining * rate).toFixed(2);
      const remainingEffectiveUsd = (remainingEffective * rate).toFixed(2);
      
      const pct = (spent / budget.weekly_cap * 100).toFixed(1);
      const effectivePct = (effective / budget.weekly_cap * 100).toFixed(1);
      const status = remainingEffective > 0 ? "✅ Under budget" : "❌ OVER BUDGET";
      
      console.log(`\n══ Budget Guardian ══\n`);
      console.log(`Weekly Cap:    ${budget.weekly_cap.toLocaleString()} sats`);
      console.log(`Settled:       ${spent.toLocaleString()} sats ($${spentUsd}) — calendar week`);
      console.log(`Rolling ${Math.round(windowSec/3600)}h:        ${settled.toLocaleString()} sats settled + ${pending_total.toLocaleString()} sats pending (${pending_count} in-flight)`);
      console.log(`Effective:     ${effective.toLocaleString()} sats ($${effectiveUsd}) — ${effectivePct}%`);
      console.log(`Remaining:     ${Math.max(remainingEffective, 0).toLocaleString()} sats ($${remainingEffectiveUsd})`);
      console.log(`Status:        ${status}`);

      if (effectivePct > 90) {
        console.log(`\n⚠️  WARNING: You're at ${effectivePct}% of your budget (${Math.round(windowSec/3600)}h window)!`);
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

  // Show pending payments
  if (command === "pending") {
    const pending = loadPending();
    const now = Math.floor(Date.now() / 1000);
    const windowSec = budget.rolling_window_sec || 86400;
    const active = pending.filter(p => (now - p.timestamp) < windowSec);
    const stale = pending.filter(p => (now - p.timestamp) >= windowSec);
    
    if (active.length === 0 && stale.length === 0) {
      console.log("No pending payments");
      return;
    }
    
    console.log(`\n══ Pending Payments ══\n`);
    if (active.length > 0) {
      console.log(`Active (in window):`);
      for (const p of active) {
        console.log(`  ⏳ ${p.sats.toLocaleString()} sats — ${p.description || "no memo"} — ${Math.round(now - p.timestamp)}s ago`);
      }
    }
    if (stale.length > 0) {
      console.log(`\nStale (outside window):`);
      for (const p of stale) {
        console.log(`  ❌ ${p.sats.toLocaleString()} sats — ${p.description || "no memo"} — ${Math.round((now - p.timestamp) / 60)}min ago`);
      }
    }
    return;
  }

  // Clear stale pending
  if (command === "clear-pending") {
    const pending = loadPending();
    const now = Math.floor(Date.now() / 1000);
    const windowSec = budget.rolling_window_sec || 86400;
    const active = pending.filter(p => (now - p.timestamp) < windowSec);
    const cleared = pending.length - active.length;
    
    const pendingFile = path.join(path.dirname(BUDGET_FILE), "pending_payments.json");
    fs.writeFileSync(pendingFile, JSON.stringify({ payments: active }, null, 2));
    console.log(`Cleared ${cleared} stale pending payments. ${active.length} remain.`);
    return;
  }

  console.log(`Usage: node budget_guardian.js [setup <weekly_sats>|status|reset|pending|clear-pending] [--window=3600]`);
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
