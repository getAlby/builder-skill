#!/usr/bin/env node
// Multi-wallet manager - switch between multiple NWC wallets
// Usage: node wallets.js [add|list|switch|remove|status] [name] [nwc_url]
// 
// Strategic advantage: Diversification - never rely on a single point of failure.
// Biblical wisdom: "The rich rule over the poor, and the borrower is slave to the lender." - Pr 22:7

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const WALLETS_FILE = path.join(process.env.HOME, ".hermes", "ledgers", "wallets.json");

function loadWallets() {
  if (fs.existsSync(WALLETS_FILE)) {
    return JSON.parse(fs.readFileSync(WALLETS_FILE, "utf8"));
  }
  return { active: null, wallets: {} };
}

function saveWallets(data) {
  fs.writeFileSync(WALLETS_FILE, JSON.stringify(data, null, 2));
}

async function main() {
  const command = process.argv[2] || "list";
  const name = process.argv[3];
  const nwcUrl = process.argv.slice(4).join(" ");

  if (command === "add") {
    if (!name || !nwcUrl) {
      console.log("Usage: node wallets.js add <name> <nwc_url>");
      console.log("  name:     Friendly name for this wallet");
      console.log("  nwc_url:  nostr+walletconnect://... full URL");
      return;
    }
    
    // Validate URL format
    if (!nwcUrl.startsWith("nostr+walletconnect://")) {
      console.error("Invalid NWC URL - must start with nostr+walletconnect://");
      return;
    }
    
    const wallets = loadWallets();
    
    // Parse pubkey for display
    const url = new URL(nwcUrl);
    const pubkey = url.hostname;
    const short = pubkey.substring(0, 8) + "..." + pubkey.substring(pubkey.length - 4);
    
    wallets.wallets[name] = {
      url: nwcUrl,
      pubkey: pubkey,
      shortPubkey: short,
      addedAt: new Date().toISOString(),
      active: false
    };
    
    if (!wallets.active) {
      wallets.active = name;
      wallets.wallets[name].active = true;
    }
    
    saveWallets(wallets);
    console.log(`✅ Wallet "${name}" added (${short})`);
    if (wallets.active === name) {
      console.log(`   Set as active wallet`);
    }
    return;
  }

  if (command === "list") {
    const wallets = loadWallets();
    if (Object.keys(wallets.wallets).length === 0) {
      console.log("No wallets registered. Add one with: node wallets.js add <name> <nwc_url>");
      return;
    }
    
    console.log("══ Registered Wallets ══\n");
    for (const [key, wallet] of Object.entries(wallets.wallets)) {
      const indicator = wallets.active === key ? " 👈 ACTIVE" : "";
      console.log(`${wallets.active === key ? "●" : "○"} ${key}${indicator}`);
      console.log(`   Pubkey: ${wallet.shortPubkey}`);
      console.log(`   Added:  ${new Date(wallet.addedAt).toLocaleDateString()}`);
      console.log();
    }
    return;
  }

  if (command === "switch") {
    if (!name) {
      console.log("Usage: node wallets.js switch <name>");
      console.log("Available wallets:");
      const wallets = loadWallets();
      Object.keys(wallets.wallets).forEach(k => console.log(`  ${k}`));
      return;
    }
    
    const wallets = loadWallets();
    if (!wallets.wallets[name]) {
      console.error(`Wallet "${name}" not found`);
      return;
    }
    
    wallets.active = name;
    for (const [k, v] of Object.entries(wallets.wallets)) {
      v.active = (k === name);
    }
    saveWallets(wallets);
    console.log(`Switched to wallet: "${name}" (${wallets.wallets[name].shortPubkey})`);
    
    // Update config_local.json for other scripts
    try {
      const configPath = path.join(process.env.HOME, ".hermes", "config_local.json");
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        config.wallet.nwc_url = wallets.wallets[name].url;
        config.wallet.nwc_wallet_pubkey = wallets.wallets[name].pubkey;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log("Updated config_local.json");
      }
    } catch (e) {
      console.log("Note: Could not update config_local.json - " + e.message);
    }
    return;
  }

  if (command === "remove") {
    if (!name) {
      console.log("Usage: node wallets.js remove <name>");
      return;
    }
    
    const wallets = loadWallets();
    if (!wallets.wallets[name]) {
      console.error(`Wallet "${name}" not found`);
      return;
    }
    
    if (wallets.active === name) {
      console.error("Cannot remove active wallet. Switch to another first.");
      return;
    }
    
    delete wallets.wallets[name];
    saveWallets(wallets);
    console.log(`Removed wallet: "${name}"`);
    return;
  }

  if (command === "status") {
    const wallets = loadWallets();
    if (!wallets.active) {
      console.log("No active wallet set.");
      return;
    }
    const active = wallets.wallets[wallets.active];
    console.log(`Active Wallet: "${wallets.active}"`);
    console.log(`Pubkey:        ${active.shortPubkey}`);
    console.log(`Total wallets: ${Object.keys(wallets.wallets).length}`);
    return;
  }

  console.log("Usage: node wallets.js [add|list|switch|remove|status] [name] [nwc_url]");
}

main().catch(e => console.error(e.message));
