---
name: alby-bitcoin-payments
description: Bitcoin Lightning wallet via NWC. Say anything natural, get confirmed transactions. Every payment cryptographically proven with SHA-256 preimage verification.
version: "7.0.0"
---

## What This Is

A complete Bitcoin Lightning wallet powered by Alby's Nostr Wallet Connect. The agent handles everything — the user just talks naturally.

## How It Works

User → says anything natural → agent does everything → confirmation.

```
User: "send 500 to alice@getalby.com"
User: "balance"
User: "create invoice for 1000 sats"
User: "my wallet"         ← one command, everything
User: "verify this payment"
```

## Core Agent Rules

**On session start:**
1. Read `wallet.nwc_url` from `~/.hermes/config_local.json`
2. If auto-ledger not running, start it in background
3. Show balance

**SECURITY: NWC URL MUST NEVER be displayed, echoed, or shared in any output, logs, or chat.**

**On every wallet operation:**
- `cd /root/.hermes/skills/alby-bitcoin-payments` first
- NWC returns millisats → always divide by 1000
- Always include fiat equivalent (USD default)
- NWC URL → never echo, never log, never display in any form
- Read URL only from `~/.hermes/config_local.json` (chmod 600) — never ask user for it again

**Before sending:**
1. Decode destination → show amount, fiat, recipient
2. Confirm: `"Send X sats ($Y) to Z? Reply YES to confirm."`
3. After paying → verify in `listTransactions()` (NWC can report false success)

**On invoice creation:**
- BOLT-11 in code block (one-tap copy)
- Include sats + fiat

**On BOLT-11 or lightning address in any message:**
- Auto-decode → show details → offer next action

## Response Style

### Balance Card
```
Wallet: alias | mainnet
Balance: 1,234 sats
$ 1.23 USD  ·  € 1.07 EUR  ·  KSh 159.20 KES
```

### Transaction Row
```
→ +100 sats ($0.07) ✅ | description  | bal: 1,234
←  -50 sats ($0.03)  ✅ | to alice     | bal: 1,184
```

### Payment Proof
```
Payment Hash:    a863be4753fe982d...
SHA-256(preimage): a863be4753fe982d...
✅ MATCH — Preimage: 9137715c...59b1
```

## Behind the Scenes

| Feature | Script | What It Does |
|---|---|---|
| Summary | `summary.js` | One-command wallet overview |
| Balance | `balance.js` | Multi-currency balance (USD/EUR/KES) |
| Invoice | `qr_invoice.js` | BOLT-11 invoice + QR code |
| Decode | `decode.js` | Parse invoices or lightning addresses |
| Analytics | `analytics.js` | Period reports with top transactions |
| Auto-Ledger | `auto_ledger.js` | Background: real-time payments + crypto proofs |
| Validate | `validate.js` | Standalone preimage verification |
| Budget | `budget_guardian.js` | Weekly spending caps with alerts |
| Streaks | `streaks.js` | Activity milestones & gamification |
| Multi-Wallet | `wallets.js` | Add/switch/remove wallets |
| Health | `health_check.js` | 6-point diagnostics |
| Export | `export_ledger.js` | CSV export for tax/audit |

## Auto-Ledger (The Trustless Core)

Every settled payment gets automatically:
1. **Verified** — SHA-256(preimage) == payment_hash
2. **Saved** — Persistent ledger at `~/.hermes/ledgers/transactions_ledger.json`
3. **Proved** — Individual proof files in `~/.hermes/ledgers/proofs/`

No transaction is ever lost. No payment can be disputed. Mathematics, not promises.

## Budget Guardian

Set a weekly spending cap. The system tracks and alerts at 90%. Pre-commitment removes the temptation of impulse spending.

```
node budget_guardian.js setup 5000    # 5000 sats/week
node budget_guardian.js status        # Current usage
node budget_guardian.js reset         # Reset for new week
```

## Initial Setup

1. `cd ~/.hermes/skills/alby-bitcoin-payments`
2. Run `npm install` (uses `package.json` in skill root)
3. Set NWC URL in `~/.hermes/config_local.json` under `wallet.nwc_url`
   ```json
   {"wallet": {"nwc_url": "nostr+walletconnect://..."}}
   ```
4. Set file permissions: `chmod 600 ~/.hermes/config_local.json`
5. Start auto-ledger: `export NWC_URL=$(python3 -c "import json; print(json.load(open('~/.hermes/config_local.json'))['wallet']['nwc_url'])") && node scripts/auto_ledger.js &`

### Running Scripts

Always export NWC URL first (scripts read from env, not config file):
```bash
cd ~/.hermes/skills/alby-bitcoin-payments
export NWC_URL=$(python3 -c "import json; print(json.load(open('~/.hermes/config_local.json'))['wallet']['nwc_url'])")
node scripts/balance.js
```

## Environment

| Path | Purpose |
|------|---------|
| `/root/.hermes/skills/alby-bitcoin-payments/` | Skill root — always `cd` here first |
| `~/.hermes/ledgers/` | Auto-ledger + proof files |
| `~/.hermes/config_local.json` | NWC URL + user config |

**Script Execution:** Always export the NWC URL before running scripts:
```bash
export NWC_URL=$(python3 -c "import json; print(json.load(open('/root/.hermes/config_local.json'))['wallet']['nwc_url'])")
```

**Important Script Argument Orders:**
- `pay.js` — takes `<amount_sats>` then `<recipient>`: `pay.js 100 user@domain.com` (amount first!)
- `qr_invoice.js` — takes `<amount_sats>` then `<description>`: `qr_invoice.js 100 "my invoice"`

**Key Operational Notes:**
- The `@getalby/sdk` NWCClient must be imported from `@getalby/sdk/nwc` (not the main module)
- The `package.json` may not be present in the installed skill directory — it's in the clone root, needed for `npm install`
- The auto-ledger (`auto_ledger.js`) does NOT start automatically — run it manually in background after wallet setup:
  ```bash
  mkdir -p ~/.hermes/ledgers/proofs && node scripts/auto_ledger.js &
  ```
- Payment verification via NWC `listTransactions()` is the authoritative source — NWC `payInvoice()` can report false success
- SHA-256 preimage verification: `crypto.createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex')` should match `payment_hash`

**PIL cards:** Disabled. Do not generate styled PIL receipt cards. Just use text confirmations and ASCII panels.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Cannot find module` | Run from skill directory — deps are in local `node_modules/` |
| Connection refused | NWC URL expired — ask for a new one |
| Amount looks 1000x wrong | NWC = millisats. Divide by 1000. |
| `payInvoice` reported success but no transaction | NWC can lie. Always check `listTransactions()` after paying |
| PIL import fails | Use `/usr/bin/python3` — the agent's venv python doesn't have Pillow |
