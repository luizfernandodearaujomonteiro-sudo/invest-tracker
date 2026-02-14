// ── Types ──

export interface IncomingTransaction {
  amount: number;     // native units (ETH, BTC, etc.)
  timestamp: number;  // unix seconds
}

// ── Balance Fetchers ──

// Etherscan V2 unified helper (works for Arbitrum and 60+ EVM chains)
async function fetchEtherscanV2Balance(chainId: number, address: string, chainLabel: string): Promise<number> {
  const apiKey = process.env.ETHERSCAN_API_KEY || "";
  const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=balance&address=${address}&tag=latest&apikey=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "1") throw new Error(`${chainLabel}: ${data.message || data.result}`);
  return Number(data.result) / 1e18;
}

// Arbitrum One (chainId 42161)
export async function fetchArbitrumBalance(address: string): Promise<number> {
  return fetchEtherscanV2Balance(42161, address, "Arbitrum");
}

// BNB Chain (public Binance RPC - Etherscan V2 free tier doesn't support BSC)
export async function fetchBscBalance(address: string): Promise<number> {
  const rpcUrl = "https://bsc-dataseed.binance.org/";
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [address, "latest"],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`BSC: ${data.error.message}`);
  return parseInt(data.result, 16) / 1e18;
}

// Bitcoin (supports both single address and xpub)
export async function fetchBitcoinBalance(address: string): Promise<number> {
  const isXpub = address.startsWith("xpub") || address.startsWith("ypub") || address.startsWith("zpub");

  if (isXpub) {
    const url = `https://blockchain.info/multiaddr?active=${address}&n=0`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Blockchain.info xpub: ${res.status}`);
    const data = await res.json();
    const satoshis = data.wallet?.final_balance ?? 0;
    return Number(satoshis) / 1e8;
  }

  const url = `https://blockchain.info/q/addressbalance/${address}?confirmations=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Blockchain.info: ${res.status}`);
  const satoshis = Number(await res.text());
  return satoshis / 1e8;
}

// Solana (public RPC - includes liquid + staked SOL)
export async function fetchSolanaBalance(address: string): Promise<number> {
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

  const [balanceRes, stakeRes] = await Promise.all([
    fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [address],
      }),
    }),
    fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "getProgramAccounts",
        params: [
          "Stake11111111111111111111111111111111111111",
          {
            encoding: "jsonParsed",
            filters: [
              { memcmp: { offset: 44, bytes: address } },
            ],
          },
        ],
      }),
    }),
  ]);

  const balanceData = await balanceRes.json();
  if (balanceData.error) throw new Error(`Solana: ${balanceData.error.message}`);
  const liquidLamports = balanceData.result?.value || 0;

  let stakedLamports = 0;
  try {
    const stakeData = await stakeRes.json();
    if (stakeData.result && Array.isArray(stakeData.result)) {
      for (const account of stakeData.result) {
        stakedLamports += account.account?.lamports || 0;
      }
    }
  } catch {
    // Staked balance fetch failed - continue with liquid only
  }

  return (liquidLamports + stakedLamports) / 1e9;
}

// XRP Ledger (public server - no key needed)
export async function fetchXrpBalance(address: string): Promise<number> {
  const res = await fetch("https://s1.ripple.com:51234/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "account_info",
      params: [{ account: address, ledger_index: "validated" }],
    }),
  });
  const data = await res.json();
  if (data.result?.error) throw new Error(`XRPL: ${data.result.error}`);
  const drops = Number(data.result?.account_data?.Balance || 0);
  return drops / 1e6;
}

// ── Transaction History Fetchers ──

// Arbitrum - Etherscan V2 txlist + txlistinternal (bridges, contract calls)
export async function fetchArbitrumTransactions(address: string): Promise<IncomingTransaction[]> {
  const apiKey = process.env.ETHERSCAN_API_KEY || "";
  const addrLower = address.toLowerCase();

  // Fetch normal and internal transactions in parallel
  const [normalRes, internalRes] = await Promise.all([
    fetch(`https://api.etherscan.io/v2/api?chainid=42161&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${apiKey}`),
    fetch(`https://api.etherscan.io/v2/api?chainid=42161&module=account&action=txlistinternal&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${apiKey}`),
  ]);

  const transactions: IncomingTransaction[] = [];

  // Process normal transactions
  const normalData = await normalRes.json();
  if (normalData.status === "1" && Array.isArray(normalData.result)) {
    for (const tx of normalData.result) {
      if (tx.to?.toLowerCase() === addrLower && tx.value !== "0" && tx.isError === "0") {
        transactions.push({
          amount: Number(tx.value) / 1e18,
          timestamp: Number(tx.timeStamp),
        });
      }
    }
  }

  // Process internal transactions (bridges, contract deposits)
  const internalData = await internalRes.json();
  if (internalData.status === "1" && Array.isArray(internalData.result)) {
    for (const tx of internalData.result) {
      if (tx.to?.toLowerCase() === addrLower && tx.value !== "0" && tx.isError !== "1") {
        transactions.push({
          amount: Number(tx.value) / 1e18,
          timestamp: Number(tx.timeStamp),
        });
      }
    }
  }

  return transactions;
}

// BSC - Etherscan V2 with chainid=56 (normal + internal transactions)
export async function fetchBscTransactions(address: string): Promise<IncomingTransaction[]> {
  const apiKey = process.env.ETHERSCAN_API_KEY || "";
  const addrLower = address.toLowerCase();

  const [normalRes, internalRes] = await Promise.all([
    fetch(`https://api.etherscan.io/v2/api?chainid=56&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${apiKey}`),
    fetch(`https://api.etherscan.io/v2/api?chainid=56&module=account&action=txlistinternal&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${apiKey}`),
  ]);

  const transactions: IncomingTransaction[] = [];

  const normalData = await normalRes.json();
  if (normalData.status === "1" && Array.isArray(normalData.result)) {
    for (const tx of normalData.result) {
      if (tx.to?.toLowerCase() === addrLower && tx.value !== "0" && tx.isError === "0") {
        transactions.push({
          amount: Number(tx.value) / 1e18,
          timestamp: Number(tx.timeStamp),
        });
      }
    }
  }

  const internalData = await internalRes.json();
  if (internalData.status === "1" && Array.isArray(internalData.result)) {
    for (const tx of internalData.result) {
      if (tx.to?.toLowerCase() === addrLower && tx.value !== "0" && tx.isError !== "1") {
        transactions.push({
          amount: Number(tx.value) / 1e18,
          timestamp: Number(tx.timeStamp),
        });
      }
    }
  }

  return transactions;
}

// Bitcoin - blockchain.info (supports xpub)
export async function fetchBitcoinTransactions(address: string): Promise<IncomingTransaction[]> {
  const isXpub = address.startsWith("xpub") || address.startsWith("ypub") || address.startsWith("zpub");
  const url = isXpub
    ? `https://blockchain.info/multiaddr?active=${address}&n=100`
    : `https://blockchain.info/rawaddr/${address}?limit=100`;

  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();

  const txs = data.txs || [];
  const transactions: IncomingTransaction[] = [];

  for (const tx of txs) {
    if (isXpub) {
      // For xpub, `result` is the net change in satoshis (positive = received)
      const netChange = tx.result;
      if (netChange > 0) {
        transactions.push({ amount: netChange / 1e8, timestamp: tx.time });
      }
    } else {
      // For single address, sum outputs sent to our address
      let received = 0;
      for (const output of tx.out || []) {
        if (output.addr === address) received += output.value;
      }
      if (received > 0) {
        transactions.push({ amount: received / 1e8, timestamp: tx.time });
      }
    }
  }

  return transactions;
}

// Solana - getSignaturesForAddress + getTransaction (parsed instructions)
// Uses System.transfer instructions instead of balance diffs to avoid
// counting staking operations, rent reclaims, etc.
// Sequential calls with delays to respect public RPC rate limits.
export async function fetchSolanaTransactions(address: string): Promise<IncomingTransaction[]> {
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const sigRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getSignaturesForAddress",
      params: [address, { limit: 50 }],
    }),
  });
  const sigData = await sigRes.json();
  if (!sigData.result || !Array.isArray(sigData.result)) return [];

  const transactions: IncomingTransaction[] = [];
  const validSigs = sigData.result.filter((s: { err: unknown }) => !s.err);

  // Sequential calls with 1s delay to avoid public RPC rate limiting
  for (let i = 0; i < validSigs.length; i++) {
    const sig = validSigs[i] as { signature: string; blockTime: number };
    if (i > 0) await delay(1000);

    try {
      const txRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTransaction",
          params: [sig.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
        }),
      });
      let txData = await txRes.json();

      // If rate-limited, wait longer and retry once
      if (txData.error?.message?.includes("Too many requests")) {
        await delay(3000);
        const retryRes = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getTransaction",
            params: [sig.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
          }),
        });
        txData = await retryRes.json();
      }

      if (!txData.result) continue;

      const topInstructions = txData.result.transaction?.message?.instructions || [];
      const innerGroups = txData.result.meta?.innerInstructions || [];
      const innerInstructions = innerGroups.flatMap(
        (group: { instructions: Record<string, unknown>[] }) => group.instructions
      );
      const allInstructions = [...topInstructions, ...innerInstructions];

      let totalReceived = 0;
      for (const ix of allInstructions) {
        if (
          ix.program === "system" &&
          ix.parsed?.type === "transfer" &&
          ix.parsed?.info?.destination === address
        ) {
          totalReceived += Number(ix.parsed.info.lamports || 0);
        }
      }

      // Filter out dust (< 0.001 SOL = 1M lamports) to avoid spam transfers
      if (totalReceived >= 1_000_000) {
        transactions.push({
          amount: totalReceived / 1e9,
          timestamp: txData.result.blockTime || sig.blockTime,
        });
      }
    } catch {
      // skip failed tx fetch
    }
  }

  return transactions;
}

// XRP - XRPL account_tx
export async function fetchXrpTransactions(address: string): Promise<IncomingTransaction[]> {
  const res = await fetch("https://s1.ripple.com:51234/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "account_tx",
      params: [{
        account: address,
        ledger_index_min: -1,
        ledger_index_max: -1,
        limit: 200,
      }],
    }),
  });
  const data = await res.json();
  if (!data.result?.transactions) return [];

  const XRPL_EPOCH = 946684800; // seconds between Unix epoch and XRPL epoch (2000-01-01)
  const transactions: IncomingTransaction[] = [];

  for (const entry of data.result.transactions) {
    const tx = entry.tx || entry.tx_json;
    const meta = entry.meta;
    if (!tx || !meta) continue;

    // Only count Payment transactions TO our address
    if (tx.TransactionType === "Payment" && tx.Destination === address) {
      // delivered_amount is more accurate than Amount (handles partial payments)
      const delivered = meta.delivered_amount ?? tx.Amount;
      if (typeof delivered === "string") {
        const drops = Number(delivered);
        if (drops > 0) {
          transactions.push({
            amount: drops / 1e6,
            timestamp: (tx.date || 0) + XRPL_EPOCH,
          });
        }
      }
    }
  }

  return transactions;
}
