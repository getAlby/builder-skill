#!/usr/bin/env node
// Create a HOLD invoice that stays pending until you settle or cancel it
// Perfect for escrow, pay-to-unlock, conditional payments
//
// Usage: NWC_URL="..." node hold_invoice.js [sats] [description]
// The script will show the invoice, then wait for payment.
// When payment arrives it will prompt you to settle or cancel.

const { NWCClient } = require("@getalby/sdk/nwc");
const { getFiatValue } = require("@getalby/lightning-tools/fiat");
const crypto = require("crypto");

const NWC_URL = process.env.NWC_URL;
const sats = parseInt(process.argv[2]) || 100;
const description = process.argv.slice(3).join(" ") || "Conditional payment";

function toHexString(bytes) {
  return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");
}

async function main() {
  if (!NWC_URL) {
    console.error("Error: NWC_URL environment variable not set");
    process.exit(1);
  }

  const client = new NWCClient({ nostrWalletConnectUrl: NWC_URL });
  
  // Generate random preimage and compute payment hash
  const preimageBytes = crypto.getRandomValues(new Uint8Array(32));
  const preimage = toHexString(preimageBytes);
  const hashBuffer = await crypto.subtle.digest("SHA-256", preimageBytes);
  const paymentHashBytes = new Uint8Array(hashBuffer);
  const paymentHash = toHexString(paymentHashBytes);
  
  // Create HOLD invoice
  const fiatUSD = await getFiatValue({ satoshi: sats, currency: "USD" });
  console.log(`Creating HOLD invoice: ${sats} sats (~$${fiatUSD.toFixed(2)} USD)`);
  console.log(`Description: ${description}`);
  console.log(`This invoice will stay PENDING until you settle or cancel it.`);
  console.log(`Payment hash: ${paymentHash}`);
  
  const invoice = await client.makeHoldInvoice({
    amount: sats * 1000,
    description,
    payment_hash: paymentHash,
  });

  console.log(`\nBOLT-11: ${invoice.invoice}`);
  console.log(`\nWaiting for payment... (Ctrl+C to cancel)`);

  // Settle notification handler
  let settled = false;
  let notified = false;
  
  console.log(`\nOnce paid, the agent will auto-settle and confirm.`);
  console.log(`(The HOLD invoice funds are locked until settlement)\n`);
  
  const unsub = await client.subscribeNotifications(async (notification) => {
    if (notification.notification.payment_hash !== paymentHash) {
      return;
    }
    
    if (notification.notification_type === "hold_invoice_accepted" && !notified) {
      notified = true;
      console.log(`\n⚡ Payment accepted! Funds locked. Settling...`);
      await client.settleHoldInvoice({ preimage });
      console.log(`✅ SETTLED. Payment of ${sats} sats has been received.`);
      settled = true;
      unsub();
      client.close();
      process.exit(0);
    }
  }, ["hold_invoice_accepted"]);

  // Timeout after 1 hour
  setTimeout(() => {
    if (!settled) {
      console.log(`\n⏰ Timeout reached. Cancelling HOLD invoice...`);
      client.cancelHoldInvoice({ payment_hash: paymentHash }).then(() => {
        console.log(`Cancelled.`);
        unsub();
        client.close();
        process.exit(0);
      });
    }
  }, 3600000); // 1 hour
}

main().catch(e => { console.error(e.message); });
