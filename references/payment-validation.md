# Payment Validation (Preimage Verification)

Verify that a Lightning Network payment was actually completed by cryptographically checking the preimage against the invoice's payment hash.

## How It Works

1. Every BOLT-11 invoice contains a `payment_hash` (SHA-256 of the preimage)
2. When payment completes, the payer's node reveals the `preimage`
3. Verifying: `SHA-256(preimage) == payment_hash` proves the payment went through
4. Only the recipient can know the preimage — so proving they had it proves they received payment

Reference implementation: https://github.com/kingonly/validate-payment
Live web validator: https://validate-payment.com/

## CLI Script (Bundled)

```bash
node scripts/validate.js [invoice] [preimage_hex]
```

Supports BOLT11 (`lnbc`/`lntb`) and BOLT12 (`lni`) invoice formats.
Shows decoded invoice details (amount, description, timestamp, expiry) plus the hash comparison.

## Node.js API

```typescript
import { decode as decodeBolt11 } from 'light-bolt11-decoder';
import crypto from 'crypto';

function validatePayment(invoice: string, preimage: string): boolean {
  const decoded = decodeBolt11(invoice);
  const paymentHash = decoded.sections.find(s => s.name === 'payment_hash').value;
  const preimageBytes = Uint8Array.from(preimage.match(/.{1,2}/g).map(h => parseInt(h, 16)));
  const computed = crypto.createHash('sha256').update(preimageBytes).digest('hex');
  return computed === paymentHash;
}
```

## When to Use

- **Pay-to-unlock content**: User pays, you deliver content, they can verify the preimage matches
- **Third-party payment proof**: Someone claims they paid — verify with preimage
- **Escrow/settlement verification**: Confirm funds actually moved before releasing goods
- **HOLD invoice confirmation**: After settling, the preimage proves the HTLC completed
- **Payment receipt verification**: Generate a verifiable receipt by providing preimage + invoice