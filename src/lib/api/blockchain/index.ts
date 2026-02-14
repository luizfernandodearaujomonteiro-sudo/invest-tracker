import type { ChainId } from "@/types/database";
import type { IncomingTransaction } from "./chains";
import {
  fetchArbitrumBalance,
  fetchBscBalance,
  fetchBitcoinBalance,
  fetchSolanaBalance,
  fetchXrpBalance,
  fetchArbitrumTransactions,
  fetchBscTransactions,
  fetchBitcoinTransactions,
  fetchSolanaTransactions,
  fetchXrpTransactions,
} from "./chains";

export interface ChainConfig {
  name: string;
  nativeTicker: string;
  fetchBalance: (address: string) => Promise<number>;
  fetchTransactions: (address: string) => Promise<IncomingTransaction[]>;
  addressRegex: RegExp;
}

export const CHAIN_REGISTRY: Record<ChainId, ChainConfig> = {
  arbitrum: {
    name: "Arbitrum",
    nativeTicker: "ETH",
    fetchBalance: fetchArbitrumBalance,
    fetchTransactions: fetchArbitrumTransactions,
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
  },
  bsc: {
    name: "BNB Chain",
    nativeTicker: "BNB",
    fetchBalance: fetchBscBalance,
    fetchTransactions: fetchBscTransactions,
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
  },
  bitcoin: {
    name: "Bitcoin",
    nativeTicker: "BTC",
    fetchBalance: fetchBitcoinBalance,
    fetchTransactions: fetchBitcoinTransactions,
    addressRegex: /^((bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}|[xyz]pub[a-zA-HJ-NP-Z0-9]{100,120})$/,
  },
  solana: {
    name: "Solana",
    nativeTicker: "SOL",
    fetchBalance: fetchSolanaBalance,
    fetchTransactions: fetchSolanaTransactions,
    addressRegex: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  },
  xrpl: {
    name: "XRP Ledger",
    nativeTicker: "XRP",
    fetchBalance: fetchXrpBalance,
    fetchTransactions: fetchXrpTransactions,
    addressRegex: /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/,
  },
};

export function validateAddress(chain: ChainId, address: string): boolean {
  return CHAIN_REGISTRY[chain].addressRegex.test(address);
}
