#!/usr/bin/env node
// Auto-decode BOLT-11 invoices or Lightning addresses from stdin
// Usage: echo "lnbc..." | node decode.js
//        echo "user@domain.com" | node decode.js

const { decodeInvoice, Invoice, LightningAddress, getFiatValue } = require("@getalby/lightning-tools");

const input = process.argv[2] || process.env.INPUT || (() => {
  let data = '';
  process.stdin.on('data', chunk => data += chunk);
  return new Promise(resolve => process.stdin.on('end', () => resolve(data.trim())));
})();

async function decodeLightningAddress(address) {
  const ln = new LightningAddress(address);
  await ln.fetch();
  
  console.log(`⚡ Lightning Address: ${address}`);
  console.log(`Username: ${ln.username}`);
  console.log(`Domain: ${ln.domain}`);
  
  if (ln.lnurlpData) {
    const minSats = Math.floor(ln.lnurlpData.min / 1000);
    const maxSats = Math.floor(ln.lnurlpData.max / 1000);
    console.log(`Min sendable: ${minSats.toLocaleString()} sats`);
    console.log(`Max sendable: ${maxSats.toLocaleString()} sats`);
    console.log(`Description: ${ln.lnurlpData.description || '(none)'}`);
    console.log(`Comment allowed: ${ln.lnurlpData.commentAllowed ? ln.lnurlpData.commentAllowed + ' chars' : 'no'}`);
  }
  
  if (ln.pubkey) {
    console.log(`Pubkey: ${ln.pubkey.substring(0, 20)}...`);
  }
  
  if (ln.nostrPubkey) {
    console.log(`Nostr pubkey: ${ln.nostrPubkey}`);
    if (ln.nostrRelays) {
      console.log(`Nostr relays: ${ln.nostrRelays.join(', ')}`);
    }
  }
  
  console.log(`\nReady to receive payments via Lightning`);
}

async function decodeBolt11(pr) {
  const parsed = decodeInvoice(pr.replace(/^LNURL|lnurl/, ''));
  
  if (!parsed) {
    console.log("Could not decode invoice");
    return;
  }
  
  const fiatUSD = await getFiatValue({ satoshi: parsed.satoshi, currency: "USD" }).catch(() => null);
  const now = Math.floor(Date.now() / 1000);
  const isExpired = parsed.expiry && (now > parsed.timestamp + parsed.expiry);
  const expiresIn = parsed.expiry ? Math.max(0, parsed.timestamp + parsed.expiry - now) : 0;
  
  console.log(`⚡ BOLT-11 Invoice`);
  console.log(`Amount: ${parsed.satoshi.toLocaleString()} sats${fiatUSD ? ` (~$${fiatUSD.toFixed(4)} USD)` : ''}`);
  console.log(`Description: ${parsed.description || '(none)'}`);
  console.log(`Payment hash: ${parsed.paymentHash}`);
  console.log(`Created: ${new Date(parsed.timestamp * 1000).toLocaleString()}`);
  console.log(`Expiry: ${parsed.expiry ? Math.floor(parsed.expiry / 3600) + ' hour(s)' : 'no expiry set'}`);
  
  if (isExpired) {
    console.log(`Status: EXPIRED`);
  } else if (parsed.expiry) {
    const mins = Math.floor(expiresIn / 60);
    const hrs = Math.floor(mins / 60);
    console.log(`Status: Active (expires in ${hrs > 0 ? hrs + 'h ' : ''}${mins % 60}m)`);
  }
  
  // Verify with Invoice class
  const inv = new Invoice({ pr });
  const isPaid = await inv.isPaid().catch(() => false);
  if (isPaid) {
    console.log(`Payment status: Already paid`);
  }
}

async function main() {
  const address = typeof input === 'string' ? input : await input;
  
  if (!address) {
    console.log("Usage: echo 'invoice_or_address' | node decode.js");
    console.log("       echo 'lnbc...' | node decode.js");
    console.log("       echo 'user@domain.com' | node decode.js");
    process.exit(1);
  }
  
  // Detect type
  if (address.match(/^ln/)) {
    await decodeBolt11(address);
  } else if (address.includes('@')) {
    await decodeLightningAddress(address);
  } else {
    console.log("Could not detect type. Expected BOLT-11 invoice (starts with 'ln') or Lightning address (user@domain)");
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
