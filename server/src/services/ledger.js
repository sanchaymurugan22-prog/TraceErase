// Receipt ledger: every receipt gets a SHA-256 fingerprint and TraceErase's Ed25519 signature; fingerprints are
// bundled into Merkle batches. Each batch root is chained to the previous one (tamper-evident) and, if a test
// wallet is configured, also published on a public blockchain (Polygon Amoy), so nobody can rewrite history,
// not even TraceErase. Only fingerprints ever leave the server, never personal data.
import { db } from '../db.js';
import { config } from '../config.js';
import { sha256, merkleRoot, merkleProof, verifyProof, stableStringify } from '../util/crypto.js';
import { signHash, verifyHash, signerId } from '../util/signing.js';
import { nowIso } from './clock.js';

/**
 * Record a receipt.
 * kind: share | deletion | request-signature | evidence | consent | complaint | certificate | message | nomination
 */
export function addReceipt({ userId = null, companyId = null, kind, title, data, signedBy }) {
  const body = { kind, title, data, signedBy, issuedAt: nowIso() };
  const hash = sha256(stableStringify(body));
  return db.insert('receipts', { userId, companyId, ...body, hash, signature: signHash(hash), signer: signerId(), batchId: null, status: 'pending' });
}

export const chainEnabled = () => !!(config.chain.rpcUrl && config.chain.privateKey);
export const explorerTx = (txHash) => (txHash ? `${config.chain.explorer}/tx/${txHash}` : null);

let anchoring = false;
export async function runBatch() {
  if (anchoring) return null;
  const pending = db.filter('receipts', r => !r.batchId);
  if (!pending.length) return null;
  anchoring = true;
  try {
    const leaves = pending.map(r => r.hash);
    const root = merkleRoot(leaves);
    const prev = db.all('batches').at(-1);
    const number = (prev?.number || 0) + 1;
    const chainHash = sha256(`${prev?.chainHash || '0x0'}|${root}|${number}`);
    const batch = db.insert('batches', {
      number, root, leaves, chainHash, prevChainHash: prev?.chainHash || null, size: leaves.length,
      anchoredAt: nowIso(), sealedAt: new Date().toISOString(), network: 'TraceErase tamper-proof log', txHash: null
    });
    for (const r of pending) db.update('receipts', r.id, { batchId: batch.id, status: 'anchored' });
    queueAnchor(batch);
    return batch;
  } finally { anchoring = false; }
}

// ---------- public blockchain ----------
// One transaction at a time, so the wallet's nonces never clash.
let chainQueue = Promise.resolve();
const queueAnchor = (batch) => {
  if (!chainEnabled()) return;
  chainQueue = chainQueue.then(() => anchorOnChain(batch)).catch(e => {
    dropRpc();
    console.warn('[ledger] on-chain anchoring failed:', e.shortMessage || e.message);
    db.update('batches', batch.id, { anchorError: String(e.shortMessage || e.message).slice(0, 200) });
  });
};

let ethersLib = null;
let liveRpc = null; // { url, provider, until }
// One provider per link, reused and never destroyed: destroying an ethers provider while a request is still
// in flight can throw outside our code and stop the server.
const providers = new Map();
const providerFor = (ethers, url) => {
  if (!providers.has(url)) {
    const network = ethers.Network.from(config.chain.chainId); // fixed network: no auto-detect retry loops
    providers.set(url, new ethers.JsonRpcProvider(url, network, { staticNetwork: network }));
  }
  return providers.get(url);
};
async function chainClient() {
  if (!ethersLib) ethersLib = (await import('ethers')).ethers;
  const ethers = ethersLib;
  if (!liveRpc || liveRpc.until < Date.now()) {
    let found = null, lastErr = null;
    for (const url of String(config.chain.rpcUrl).split(',').map(s => s.trim()).filter(Boolean)) {
      const provider = providerFor(ethers, url);
      try {
        await Promise.race([provider.getBlockNumber(), new Promise((_, rej) => setTimeout(() => rej(new Error('No answer from ' + url)), 7000))]);
        found = { url, provider, until: Date.now() + 10 * 60000 };
        break;
      } catch (e) { lastErr = e; }
    }
    if (!found) throw new Error('Could not reach the blockchain: ' + (lastErr?.shortMessage || lastErr?.message || 'no RPC link set'));
    liveRpc = found;
  }
  const provider = liveRpc.provider;
  const wallet = new ethers.Wallet(config.chain.privateKey.startsWith('0x') ? config.chain.privateKey : '0x' + config.chain.privateKey, provider);
  return { ethers, provider, wallet };
}
// Forget the working link after an error, so the next try checks the links again.
const dropRpc = () => { liveRpc = null; };

/** Text written on chain for a batch: "TraceErase#<n>:" followed by the 32-byte Merkle root. */
const payloadFor = (ethers, batch) => ethers.hexlify(ethers.toUtf8Bytes(`TraceErase#${batch.number}:`)) + batch.root.slice(2);

async function feeOverrides(ethers, provider) {
  // Polygon rejects tips below ~25 gwei, so never go under 30 gwei.
  const [fee, block] = await Promise.all([provider.getFeeData(), provider.getBlock('latest')]);
  const minTip = ethers.parseUnits('30', 'gwei');
  const tip = fee.maxPriorityFeePerGas && fee.maxPriorityFeePerGas > minTip ? fee.maxPriorityFeePerGas : minTip;
  const base = block?.baseFeePerGas || 0n;
  return { maxPriorityFeePerGas: tip, maxFeePerGas: base * 2n + tip };
}

async function anchorOnChain(batch) {
  const { ethers, provider, wallet } = await chainClient();
  const overrides = await feeOverrides(ethers, provider);
  let tx;
  if (config.chain.contract) {
    const c = new ethers.Contract(config.chain.contract, ['function anchor(bytes32 root, uint256 batch) external'], wallet);
    tx = await c.anchor(batch.root, batch.number, overrides);
  } else {
    tx = await wallet.sendTransaction({ to: wallet.address, value: 0n, data: payloadFor(ethers, batch), ...overrides });
  }
  db.update('batches', batch.id, { network: config.chain.network, txHash: tx.hash, anchorError: null });
  const rcpt = await tx.wait(1, 120000);
  db.update('batches', batch.id, { onChainConfirmed: rcpt?.status === 1, blockNumber: rcpt?.blockNumber ?? null });
}

const chainChecks = new Map();
/**
 * Ask the public blockchain itself whether it holds this batch's root.
 * Returns { checked, onChain, txHash, explorerUrl, blockNumber, error }.
 */
export async function verifyBatchOnChain(batchId) {
  const b = db.get('batches', batchId);
  if (!b) return { checked: false, onChain: false, error: 'Unknown seal' };
  const base = { txHash: b.txHash || null, explorerUrl: explorerTx(b.txHash), network: b.network };
  if (!b.txHash) return { ...base, checked: false, onChain: false, error: chainEnabled() ? (b.anchorError || 'Not published yet') : 'Public blockchain not switched on' };
  const cached = chainChecks.get(b.id);
  if (cached?.onChain) return cached;
  try {
    const { ethers, provider } = await chainClient();
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('The blockchain did not answer in time')), 9000));
    const tx = await Promise.race([provider.getTransaction(b.txHash), timeout]);
    if (!tx) return { ...base, checked: true, onChain: false, error: 'Transaction not found yet' };
    let onChain;
    if (config.chain.contract && tx.to && tx.to.toLowerCase() === config.chain.contract.toLowerCase()) {
      const c = new ethers.Contract(config.chain.contract, ['function roots(uint256) view returns (bytes32)'], provider);
      onChain = (await Promise.race([c.roots(b.number), timeout])).toLowerCase() === b.root.toLowerCase();
    } else {
      onChain = String(tx.data).toLowerCase() === payloadFor(ethers, b).toLowerCase();
    }
    const out = { ...base, checked: true, onChain, blockNumber: tx.blockNumber ?? b.blockNumber ?? null, confirmed: tx.blockNumber != null };
    chainChecks.set(b.id, out);
    return out;
  } catch (e) {
    dropRpc();
    return { ...base, checked: false, onChain: false, error: String(e.shortMessage || e.message).slice(0, 160) };
  }
}

export function verifyReceipt(receiptId) {
  const r = db.get('receipts', receiptId);
  if (!r) return { found: false };
  const recomputed = sha256(stableStringify({ kind: r.kind, title: r.title, data: r.data, signedBy: r.signedBy, issuedAt: r.issuedAt }));
  const intact = recomputed === r.hash;
  // The signature is checked against the recomputed fingerprint, so any edit also breaks the signature.
  const signed = !!r.signature;
  const signatureOk = signed ? verifyHash(recomputed, r.signature) : null;
  const sig = { signed, signatureOk, signer: r.signer || null };
  if (!r.batchId) return { found: true, intact, anchored: false, ...sig, receipt: publicReceipt(r) };
  const b = db.get('batches', r.batchId);
  const proof = merkleProof(b.leaves, r.hash);
  const inBatch = !!proof && verifyProof(r.hash, proof, b.root);
  // check the chain of batch roots up to this batch
  const all = db.all('batches');
  let prev = '0x0', chainOk = true;
  for (const x of all) {
    if (sha256(`${prev}|${x.root}|${x.number}`) !== x.chainHash) { chainOk = false; break; }
    prev = x.chainHash;
    if (x.id === b.id) break;
  }
  return {
    found: true, intact, anchored: true, inBatch, chainOk, ...sig,
    valid: intact && inBatch && chainOk && signatureOk !== false,
    receipt: publicReceipt(r),
    batch: {
      id: b.id, number: b.number, root: b.root, size: b.size, anchoredAt: b.anchoredAt, network: b.network, txHash: b.txHash, chainHash: b.chainHash,
      explorerUrl: explorerTx(b.txHash), onChainConfirmed: !!b.onChainConfirmed, publicChain: chainEnabled()
    },
    proof
  };
}

/**
 * The public Proof Explorer: the newest seals and whether the whole chain of seals is unbroken.
 * Only seal numbers, times, counts and codes; never receipts or anything about a person.
 */
export function ledgerSeals(limit = 25) {
  const all = db.all('batches');
  let prev = '0x0', broken = null;
  const linked = new Map();
  for (const x of all) {
    const ok = !broken && sha256(`${prev}|${x.root}|${x.number}`) === x.chainHash;
    if (!ok && !broken) broken = x.number;
    linked.set(x.id, ok);
    prev = x.chainHash;
  }
  const realTime = (b) => b.sealedAt || b.anchoredAt;
  const n = Math.max(1, Math.min(100, Number(limit) || 25));
  const seals = all.slice(-n).reverse().map(b => ({
    number: b.number, sealedAt: realTime(b), records: b.size, root: b.root, chainHash: b.chainHash,
    linked: linked.get(b.id), network: b.network, txHash: b.txHash || null, explorerUrl: explorerTx(b.txHash),
    onChain: !!b.txHash, confirmed: !!b.onChainConfirmed, pending: !b.txHash && chainEnabled() && !b.anchorError
  }));
  const last = all.at(-1);
  return {
    stats: {
      seals: all.length, records: all.reduce((a, b) => a + (b.size || 0), 0),
      onChain: all.filter(b => b.txHash).length, lastSealAt: last ? realTime(last) : null,
      chainUnbroken: !broken, brokenAt: broken, publicChain: chainEnabled(),
      network: chainEnabled() ? config.chain.network : 'TraceErase tamper-proof log',
      intervalSec: config.batchIntervalSec
    },
    seals
  };
}

export const publicReceipt = (r) => r && ({ id: r.id, kind: r.kind, title: r.title, hash: r.hash, issuedAt: r.issuedAt, status: r.status, batchId: r.batchId, signature: r.signature || null, signer: r.signer || null });

// If the blockchain was unreachable, try those seals again later (a few times, newest first).
let retrying = false;
function retryUnpublished() {
  if (!chainEnabled() || retrying) return;
  const waiting = db.filter('batches', b => !b.txHash && b.anchorError && (b.anchorAttempts || 0) < 3).slice(-3);
  if (!waiting.length) return;
  retrying = true;
  for (const b of waiting) { db.update('batches', b.id, { anchorAttempts: (b.anchorAttempts || 0) + 1 }); queueAnchor(b); }
  chainQueue = chainQueue.finally(() => { retrying = false; });
}

let timer;
export function startLedger() {
  clearInterval(timer);
  timer = setInterval(() => { runBatch().catch(e => console.error('[ledger]', e)); retryUnpublished(); }, config.batchIntervalSec * 1000);
}
