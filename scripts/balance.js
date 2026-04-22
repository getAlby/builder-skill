#!/usr/bin/env node
// Beautiful multi-currency balance dashboard
// Usage: NWC_URL="..." node balance.js [currency1] [currency2] ...
// Default: USD EUR KES

const { NWCClient } = require("@getalby/sdk/nwc");
const { getFiatValue, getFiatBtcRate } = require("@getalby/lightning-tools/fiat");

const NWC_URL = process.env.NWC_URL;
const currencies = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['USD', 'EUR', 'KES'];

async function main() {
  if (!NWC_URL) {
    console.error("Error: NWC_URL environment variable not set");
    process.exit(1);
  }

  const client = new NWCClient({ nostrWalletConnectUrl: NWC_URL });
  
  // Fetch rates for all requested currencies dynamically
  const rateData = await Promise.all(
    currencies.map(c => ({
      code: c,
      rate: getFiatValue({ satoshi: 1, currency: c }).catch(() => null),
    }))
  );
  
  // Resolve all rate promises
  const rates = await Promise.all(rateData.map(r => r.rate));
  
  // Symbol map for common currencies
  const symbols = { USD: '$', EUR: '€', GBP: '£', KES: 'KSh', JPY: '¥', CAD: 'C$', AUD: 'A$' };
  
  const [balance, info] = await Promise.all([
    client.getBalance(),
    client.getInfo(),
  ]);
  const sats = balance.balance / 1000;
  
  console.log(`Wallet: ${info.alias} | ${info.network}`);
  console.log(`Balance: ${sats.toLocaleString()} sats`);
  console.log(``);
  
  for (let i = 0; i < rateData.length; i++) {
    const { code } = rateData[i];
    const rate = rates[i];
    const sym = symbols[code] || '';
    if (rate === null) {
      console.log(`${sym ?? ''} (rate unavailable) ${code}`);
      continue;
    }
    const val = sats * rate;
    if (val >= 1) {
      console.log(`${sym} ${val.toFixed(2)} ${code}`);
    } else {
      console.log(`${sym} ${val.toFixed(4)} ${code}`);
    }
  }
  
  console.log(``);
  // Show per-sat rates for requested currencies
  for (let i = 0; i < rateData.length; i++) {
    const { code } = rateData[i];
    const rate = rates[i];
    const sym = symbols[code] || '';
    if (rate !== null) {
      console.log(`1 sat = ${sym}${rate.toFixed(6)} ${code}`);
    }
  }

  client.close();
}

main().catch(e => { console.error(e.message); });
