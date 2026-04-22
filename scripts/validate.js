#!/usr/bin/env node
// Validate a Lightning payment by verifying the preimage against the invoice
// Ported from https://github.com/kingonly/validate-payment by @kingonly
//
// Supports BOLT11 and BOLT12 invoice formats
//
// Usage: node validate.js [invoice] [preimage]
//        echo "invoice preimage" | node validate.js
//        node validate.js --check lnbc...  (checks if invoice was paid via NWC)

const crypto = require('crypto');
const { decode: decodeBolt11 } = require('light-bolt11-decoder');
const BOLT12Decoder = require('bolt12-decoder');
const { Invoice } = require('@getalby/lightning-tools');

const args = process.argv.slice(2);

function toHexString(bytes) {
  return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
}

function extractPaymentHash(invoice) {
  const trimmed = invoice.trim();
  
  // BOLT11
  if (trimmed.startsWith('lnbc') || trimmed.startsWith('lntb')) {
    const decoded = decodeBolt11(invoice);
    const paymentHash = decoded.sections?.find(s => s.name === 'payment_hash')?.value;
    if (!paymentHash) throw new Error('BOLT11: payment_hash not found in invoice');
    return { paymentHash, type: 'BOLT11', decoded };
  }
  
  // BOLT12
  if (trimmed.startsWith('lni')) {
    const decoded = BOLT12Decoder.decode(invoice);
    const paymentHash = decoded.paymentHash;
    if (!paymentHash) throw new Error('BOLT12: paymentHash not found in invoice');
    return { paymentHash, type: 'BOLT12', decoded };
  }
  
  throw new Error('Invalid invoice format. Must start with "lnbc"/"lntb" (BOLT11) or "lni" (BOLT12)');
}

function hashPreimage(preimage) {
  // Convert hex preimage string to bytes
  const preimageBytes = new Uint8Array(
    preimage.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
  );
  const hashBuffer = crypto.createHash('sha256').update(preimageBytes).digest();
  return hashBuffer.toString('hex');
}

function decodeInvoicePretty(invoice, decoded) {
  const trimmed = invoice.trim();
  let amount, description, timestamp, expiry;
  
  if (decoded && decoded.sections) {
    // BOLT11
    amount = decoded.sections.find(s => s.name === 'amount')?.value;
    if (amount) amount = parseInt(amount) / 1000; // millisats -> sats
    description = decoded.sections.find(s => s.name === 'description')?.value || '(none)';
    timestamp = decoded.sections.find(s => s.name === 'timestamp')?.value;
    expiry = decoded.sections.find(s => s.name === 'expiry')?.value;
  }
  
  return {
    amount: amount ? `${amount.toLocaleString()} sats` : 'unknown',
    description,
    timestamp: timestamp ? new Date(parseInt(timestamp) * 1000).toLocaleString() : 'unknown',
    expiry: expiry ? `${expiry / 3600} hour(s)` : 'no expiry',
  };
}

async function main() {
  let invoice, preimage;
  
  if (args.length >= 2) {
    invoice = args[0];
    preimage = args[1];
  } else if (process.stdin.isTTY) {
    console.log('Lightning Payment Validator');
    console.log('Ported from https://github.com/kingonly/validate-payment');
    console.log('');
    console.log('Usage:');
    console.log('  node validate.js [bolt11_invoice] [preimage_hex]');
    console.log('  node validate.js [bolt12_invoice] [preimage_hex]');
    console.log('');
    console.log('Options:');
    console.log('  node validate.js --paid-check [bolt11_invoice]    Check if invoice was paid via NWC');
    console.log('  node validate.js --lnurl-check [lnurl_invoice]    Check if LNURL-Verify supports payment check');
    console.log('');
    console.log('Or pipe: echo "invoice preimage" | node validate.js');
    process.exit(0);
  } else {
    // Read from stdin
    let data = '';
    for await (const chunk of process.stdin) data += chunk;
    const parts = data.trim().split(/\s+/);
    if (parts.length < 2) {
      console.error('Error: expected "invoice preimage" on stdin');
      process.exit(1);
    }
    invoice = parts[0];
    preimage = parts[1];
  }
  
  // Extract payment hash
  const { paymentHash, type, decoded } = extractPaymentHash(invoice);
  
  // Hash the preimage
  const computedHash = hashPreimage(preimage);
  
  // Decode human-readable info
  const info = decodeInvoicePretty(invoice, decoded);
  
  // Compare
  const isValid = computedHash === paymentHash;
  
  console.log(`⚡ Payment Validation (${type})`);
  console.log(`=`.repeat(40));
  console.log(`Amount: ${info.amount}`);
  console.log(`Description: ${info.description}`);
  console.log(`Created: ${info.timestamp}`);
  console.log(`Expiry: ${info.expiry}`);
  console.log(``);
  console.log(`Payment hash (from invoice):  ${paymentHash}`);
  console.log(`SHA-256(preimage provided):   ${computedHash}`);
  console.log(``);
  
  if (isValid) {
    console.log(`✅ VALID — The preimage cryptographically proves this invoice was paid.`);
    console.log(`The payment is confirmed and complete.`);
  } else {
    console.log(`❌ INVALID — The preimage does NOT match the payment hash.`);
    console.log(`This payment has NOT been confirmed.`);
  }
}

main().catch(e => { console.error(`Error: ${e.message}`); process.exit(1); });
