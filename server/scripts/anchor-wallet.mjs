#!/usr/bin/env node
// Creates (once) a TEST-ONLY Polygon Amoy wallet for publishing TraceErase seals on a public blockchain,
// and shows its address and balance. Run from the project folder:
//
//   node server/scripts/anchor-wallet.mjs
//
// The private key is written ONLY to server/anchor-wallet.secret.txt on this computer (ignored by git).
// It is never printed here, so a screenshot of this window is safe to share.
// This wallet only ever holds free test POL from a faucet. Never send real money to it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.resolve(here, '..');
const ROOT = path.resolve(SERVER, '..');
const FILE = path.join(SERVER, 'anchor-wallet.secret.txt');
const RPCS = ['https://polygon-amoy.drpc.org', 'https://polygon-amoy.api.onfinality.io/public', 'https://rpc-amoy.polygon.technology'];
const CHAIN_ID = 80002;
const EXPLORER = 'https://amoy.polygonscan.com';

let ethers;
try { ({ ethers } = await import('ethers')); }
catch {
  console.log('\n  The "ethers" library is missing. Run this first, then try again:\n\n    npm install\n');
  process.exit(1);
}

// Make sure git will never pick up the secret file
const gi = path.join(ROOT, '.gitignore');
const ignore = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
if (!/^\*\.secret\.txt$/m.test(ignore)) fs.appendFileSync(gi, '\n# Test wallet for public blockchain anchoring (never commit)\n*.secret.txt\n');

let address;
if (fs.existsSync(FILE)) {
  const txt = fs.readFileSync(FILE, 'utf8');
  address = (txt.match(/^ADDRESS=(0x[0-9a-fA-F]{40})$/m) || [])[1];
  console.log('\n  Using your existing test wallet.');
} else {
  const w = ethers.Wallet.createRandom();
  address = w.address;
  fs.writeFileSync(FILE, [
    '# TraceErase TEST-ONLY wallet (Polygon Amoy testnet). Free test coins only. Never send real money here.',
    '# Keep this file private. Never paste it in a chat, email or GitHub.',
    '#',
    '# Render → traceerase-api → Environment → Add environment variable:',
    '#   Key:   ANCHOR_PRIVATE_KEY',
    '#   Value: the long text after PRIVATE_KEY= below (starts with 0x)',
    '',
    `ADDRESS=${w.address}`,
    `PRIVATE_KEY=${w.privateKey}`,
    ''
  ].join('\n'), { mode: 0o600 });
  console.log('\n  Created a new TEST-ONLY wallet.');
}
if (!address) { console.log('  Could not read the wallet file:', FILE); process.exit(1); }

console.log(`
  Wallet address (safe to share):
    ${address}

  Private key: saved only in
    ${FILE}
  (not shown here on purpose)
`);

let balance = null;
// Fixed network (no auto-detect), so a dead link fails fast instead of retrying forever
const network = ethers.Network.from(CHAIN_ID);
for (const url of RPCS) {
  const provider = new ethers.JsonRpcProvider(url, network, { staticNetwork: network });
  try {
    const wei = await Promise.race([provider.getBalance(address), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 8000))]);
    balance = ethers.formatEther(wei);
  } catch { /* try the next public link */ }
  if (balance !== null) break;
}
if (balance === null) console.log('  Balance: could not reach Polygon Amoy right now. Try again in a minute.');
else console.log(`  Balance: ${Number(balance).toFixed(4)} test POL ${Number(balance) > 0 ? '✓ ready' : '(empty: get free test POL first)'}`);

console.log(`
  Next steps
    1. Free test coins: open https://faucet.polygon.technology , choose "Polygon Amoy",
       paste the address above, and request POL.
    2. Run this command again to see the balance arrive.
    3. Open the secret file:   open "${FILE}"
       Copy the value after PRIVATE_KEY= into Render as ANCHOR_PRIVATE_KEY, then save.
       (Render redeploys by itself. Nothing else to set.)
    4. Check your wallet's activity: ${EXPLORER}/address/${address}
`);
process.exit(0);
