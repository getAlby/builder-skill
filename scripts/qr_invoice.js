#!/usr/bin/env node
// Create a Lightning invoice and generate a scannable QR code
// Usage: node qr_invoice.js [sats] [description]

const { NWCClient } = require("@getalby/sdk/nwc");
const { getFiatValue } = require("@getalby/lightning-tools/fiat");
const qrcode = require("qrcode");
const fs = require("fs");

const NWC_URL = process.env.NWC_URL;
const sats = parseInt(process.argv[2]) || 100;
const description = process.argv.slice(3).join(" ") || "Payment";

async function main() {
  if (!NWC_URL) {
    console.error("Error: NWC_URL environment variable not set");
    process.exit(1);
  }

  const client = new NWCClient({ nostrWalletConnectUrl: NWC_URL });
  const [fiatUSD, invoice] = await Promise.all([
    getFiatValue({ satoshi: sats, currency: "USD" }),
    client.makeInvoice({ amount: sats * 1000, description }),
  ]);

  // Generate QR code
  const qrPath = `${process.cwd()}/invoice_${sats}sats_${Date.now()}.png`;
  await qrcode.toFile(qrPath, invoice.invoice, { width: 400, margin: 2 });

  console.log(`Invoice: ${sats} sats (~$${fiatUSD.toFixed(2)} USD)`);
  console.log(`Description: ${description}`);
  console.log(`QR: ${qrPath}`);
  console.log(`Invoice: ${invoice.invoice}`);

  client.close();
}

main().catch(e => { console.error(e.message); process.exit(1); });
