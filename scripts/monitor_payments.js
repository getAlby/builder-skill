#!/usr/bin/env node
// Watch for incoming/outgoing payments and log them with fiat values
// Runs in background, outputs a line per payment event
// Usage: NWC_URL="..." node monitor_payments.js
// Tip: pipe output to a file or use with tail -f

const { NWCClient } = require("@getalby/sdk/nwc");
const { getFiatValue } = require("@getalby/lightning-tools/fiat");

const NWC_URL = process.env.NWC_URL;

async function main() {
  if (!NWC_URL) {
    console.error("Error: NWC_URL environment variable not set");
    process.exit(1);
  }

  const client = new NWCClient({ nostrWalletConnectUrl: NWC_URL });
  
  const onNotification = async (notification) => {
    const n = notification.notification;
    const sats = n.amount / 1000;
    const isRecv = notification.notification_type === "payment_received";
    const arrow = isRecv ? "→" : "←";
    const emoji = isRecv ? "💰 Payment received" : "💸 Payment sent";
    
    let fiat = '...';
    try {
      const rate = await getFiatValue({ satoshi: sats, currency: "USD" });
      fiat = "$" + rate.toFixed(2);
    } catch (e) {}
    
    console.log(`${emoji} ${arrow} ${sats} sats (${fiat}) | ${n.description || '(no description)'} | ${new Date().toLocaleTimeString()}`);
    
    // Flush stdout immediately
    if (process.stdout._handle) process.stdout._handle.setBlocking(true);
  };

  const unsub = await client.subscribeNotifications(onNotification, ["payment_received", "payment_sent"]);
  console.log(`👀 Monitoring wallet for payments... (Ctrl+C to stop)`);
  
  // Keep alive
  process.on('SIGINT', () => {
    unsub();
    client.close();
    console.log(`Stopped monitoring.`);
    process.exit(0);
  });
}

main().catch(e => { console.error(e.message); process.exit(1); });
