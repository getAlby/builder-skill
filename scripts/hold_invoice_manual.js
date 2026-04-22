#!/usr/bin/env node
// Create a HOLD invoice for MANUAL settlement (escrow mode)
// When payment arrives, the script reports it and waits for stdin command.
//
// Usage: NWC_URL="..." node hold_invoice_manual.js [sats] [description]
// When funded: type 'settle' or 'cancel' + Enter

const { NWCClient } = require("@getalby/sdk/nwc");
const { getFiatValue } = require("@getalby/lightning-tools/fiat");
const crypto = require("crypto");

const NWC_URL = process.env.NWC_URL;
const sats = parseInt(process.argv[2]) || 100;
const description = process.argv.slice(3).join(" ") || "Escrow payment";

function toHexString(bytes) {
  return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");
}

async function main() {
  if (!NWC_URL) {
    console.error("Error: NWC_URL environment variable not set");
    process.exit(1);
  }

  const client = new NWCClient({ nostrWalletConnectUrl: NWC_URL });
  
  const preimageBytes = crypto.getRandomValues(new Uint8Array(32));
  const preimage = toHexString(preimageBytes);
  const hashBuffer = await crypto.subtle.digest("SHA-256", preimageBytes);
  const paymentHash = toHexString(new Uint8Array(hashBuffer));
  
  const fiatUSD = await getFiatValue({ satoshi: sats, currency: "USD" });
  const invoice = await client.makeHoldInvoice({
    amount: sats * 1000,
    description,
    payment_hash: paymentHash,
  });

  console.log(`Escrow HOLD Invoice: ${sats} sats (~$${fiatUSD.toFixed(2)} USD)`);
  console.log(`Description: ${description}`);
  console.log(`Invoice: ${invoice.invoice}`);
  console.log(`\nWaiting for payment... (type 'settle' or 'cancel' + Enter when funded)`);
  
  let funded = false;
  let unsub;
  
  unsub = await client.subscribeNotifications(async (notification) => {
    if (notification.notification.payment_hash !== paymentHash) return;
    
    if (notification.notification_type === "hold_invoice_accepted" && !funded) {
      funded = true;
      console.log(`\n⚡ HOLD invoice ACCEPTED — ${sats} sats are LOCKED in escrow.`);
      console.log(`Type 'settle' to release funds to wallet, or 'cancel' to refund payer:`);
    }
  }, ["hold_invoice_accepted"]);

  // Read stdin for commands
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async (data) => {
    const cmd = data.trim().toLowerCase();
    if (cmd === 'settle' && funded) {
      console.log('Settling...');
      await client.settleHoldInvoice({ preimage });
      console.log('✅ FUNDS RELEASED. Payment settled.');
      unsub();
      client.close();
      process.exit(0);
    } else if (cmd === 'cancel' && funded) {
      console.log('Cancelling...');
      await client.cancelHoldInvoice({ payment_hash: paymentHash });
      console.log('❌ CANCELLED. Payer funds refunded.');
      unsub();
      client.close();
      process.exit(0);
    }
  });
  
  // 1 hour timeout
  setTimeout(() => {
    console.log('\n⏰ Timeout. Cancelling HOLD invoice...');
    client.cancelHoldInvoice({ payment_hash: paymentHash }).catch(() => {});
    unsub();
    client.close();
    process.exit(0);
  }, 3600000);
}

main().catch(e => { console.error(e.message); });
