# Alby Bitcoin Lightning Wallet Skill — Community Edition

A complete Bitcoin Lightning wallet powered by Alby's Nostr Wallet Connect. The agent handles everything — you just talk naturally.

Every payment gets **cryptographically proven** with SHA-256 preimage verification. No transaction is ever lost. No payment can be disputed.

## What It Does

| Say This | Get This |
|----------|----------|
| "balance" | Multi-currency balance + styled card |
| "create invoice 100 sats" | BOLT-11 + QR code + styled receipt |
| "send 500 to alice@getalby.com" | Confirmed payment with preimage proof |
| "wallet summary" | Complete one-command overview |
| "verify this payment" | SHA-256 cryptographic proof |

## Features

- **Auto-Ledger** — Background process that verifies and saves every settled payment with SHA-256 preimage proofs
- **Budget Guardian** — Weekly spending caps with 90% alerts (commitment device)
- **Multi-Wallet** — Add, switch, and manage multiple N wallets
- **Activity Milestones** — Gamified streak tracking
- **Styled Receipt Cards** — Beautiful PIL/Pillow cards for messaging platforms
- **6-Point Health Diagnostics** — Instant wallet status check
- **CSV Export** — Tax-ready, audit-proof transaction records
- **Safety Confirmations** — Mandatory confirmation before any outgoing payment
- **NWC Lie Detection** — Verifies every payment appears in transaction history after send

## Install

### For Hermes Agent Users

```bash
# Drop into your skills directory
git clone https://github.com/getAlby/alby-agent-skill.git ~/.hermes/skills/alby-bitcoin-payments
cd ~/.hermes/skills/alby-bitcoin-payments
npm install @getalby/sdk @getalby/lightning-tools light-bolt11-decoder qrcode
```

### Configure

Save your NWC URL in `~/.hermes/config_local.json`:

```json
{
  "wallet": {
    "nwc_url": "nostr+walletconnect://..."
  }
}
```

### Requirements

- Node.js 22+
- Python 3 with Pillow (for styled cards)
- Alby NWC wallet connection

## Test Wallet

Get instant test wallet with 10,000 sats:

```bash
curl -X POST https://faucet.nwc.dev?balance=10000
```

## What Makes This Special

Every payment is a **trustless cryptographic event**. The preimage proves it happened — mathematics, not promises.

A wallet without verified preimages is just a claim. This skill turns claims into proof.

---

Built on: [Alby JS SDK](https://github.com/getAlby/js-sdk) · [Alby Lightning Tools](https://github.com/getAlby/js-lightning-tools) · [NIP-47 NWC Protocol](https://github.com/nostr-protocol/nips/blob/master/47.md)
