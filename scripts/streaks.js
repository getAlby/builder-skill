#!/usr/bin/env node
// Payment Streaks & Gamification - track wallet activity patterns
// Usage: NWC_URL="..." node streaks.js

const { NWCClient } = require("@getalby/sdk/nwc");
const { getFiatValue } = require("@getalby/lightning-tools/fiat");

async function main() {
  const client = new NWCClient({ nostrWalletConnectUrl: process.env.NWC_URL });
  try {
    const txs = await client.listTransactions({ limit: 100 });
    const settled = txs.transactions.filter(t => t.state === "settled");
    
    if (settled.length === 0) {
      console.log("No settled transactions yet. Make a transaction to start your streak!");
      return;
    }

    // Calculate streaks
    const now = Math.floor(Date.now() / 1000);
    const oneDay = 86400;
    
    let currentStreak = 1;
    let longestStreak = 1;
    let tempStreak = 1;
    
    const sorted = [...settled].sort((a, b) => b.settled_at - a.settled_at);
    
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i-1].settled_at - sorted[i].settled_at;
      const daysApart = Math.floor(gap / oneDay);
      
      if (daysApart <= 1) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        if (daysApart > 2) {
          if (currentStreak === tempStreak && i < sorted.length / 2) {
            currentStreak = 1; // Streak broken
          }
          tempStreak = 1;
        } else {
          tempStreak++;
        }
      }
    }
    
    const totalIncoming = sorted.filter(t => t.type === "incoming").length;
    const totalOutgoing = sorted.filter(t => t.type === "outgoing").length;
    const totalSatsIncoming = sorted.filter(t => t.type === "incoming").reduce((s, t) => s + t.amount/1000, 0);
    const totalSatsOutgoing = sorted.filter(t => t.type === "outgoing").reduce((s, t) => s + t.amount/1000, 0);
    
    const rate = await getFiatValue({ satoshi: 1, currency: "USD" });
    
    console.log("══ Lightning Stats ══\n");
    console.log(`Total txns:     ${settled.length} (${totalIncoming} in, ${totalOutgoing} out)`);
    console.log(`Sats received:  ${totalSatsIncoming.toLocaleString()} (~$${(totalSatsIncoming * rate).toFixed(2)})`);
    console.log(`Sats sent:      ${totalSatsOutgoing.toLocaleString()} (~$${(totalSatsOutgoing * rate).toFixed(2)})`);
    console.log(`Longest streak: ${longestStreak} days`);
    console.log(`First txn:      ${new Date(sorted[sorted.length-1].settled_at * 1000).toLocaleDateString()}`);
    console.log(`Last txn:       ${new Date(sorted[0].settled_at * 1000).toLocaleString()}`);
    
    // Milestones
    console.log("\n══ Milestones ══");
    const milestones = [10, 50, 100, 500, 1000, 5000, 10000];
    for (const ms of milestones) {
      if (totalSatsIncoming + totalSatsOutgoing >= ms) {
        console.log(`${ms.toLocaleString()} sats total: ✅`);
      } else {
        console.log(`${ms.toLocaleString()} sats total: 🔲 (${ms - (totalSatsIncoming + totalSatsOutgoing)} to go)`);
      }
    }

  } finally {
    client.close();
  }
}

main().catch(e => console.error(e.message));
