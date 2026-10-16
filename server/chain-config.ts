/**
 * server/chain-config.ts
 *
 * Arc / USDC network configuration for server-side payment operations.
 * All sensitive values come from environment variables.
 * Contract addresses and RPC endpoints come from the onchain-facts registry.
 * This file is server-only — never import it from src/.
 *
 * Environment variables:
 *   DIMELY_ENV               — "testnet" (default) | "mainnet"
 *   ARC_CHAIN_ID             — override chain ID (optional; defaults to registry value)
 *   TREASURY_ADDRESS         — Dimely treasury wallet that receives platform fees
 *   SERVER_SIGNER_PRIVATE_KEY — Server wallet key for automated operations (never expose to browser)
 *   RPC_PROXY_BASE_URL       — Arc Studio RPC proxy base URL
 *   RPC_PROXY_TOKEN          — Arc Studio RPC proxy token
 *   RPC_PROXY_CHAINS         — Comma-separated Compass chain keys covered by the proxy
 */

// Registry values — imported at module load time so we never hardcode addresses or RPC URLs.
// The registry is a pure TypeScript module; Bun can load it directly without Vite.
import { getChain, getUsdc } from '../src/onchain-facts'

export type NetworkEnv = 'testnet' | 'mainnet'

export interface ChainConfig {
  env: NetworkEnv
  chainId: number
  rpcUrl: string
  explorerBase: string
  usdcAddress: string
  usdcDecimals: number
  treasuryAddress: string | null
  /** Private key for server-side signing. NEVER expose to the browser. */
  serverSignerKey: string | null
  /** Minimum withdrawal in display units (e.g. 1.0 = $1 USDC) */
  minWithdrawalAmount: number
  /** Blocks to wait before considering a payment confirmed */
  requiredConfirmations: number
}

// Arc Testnet chain ID (5042002) and Arc Mainnet chain ID (5042) from the registry
const TESTNET_CHAIN_ID = 5042002
const MAINNET_CHAIN_ID = 5042

const ENV: NetworkEnv = process.env.DIMELY_ENV === 'mainnet' ? 'mainnet' : 'testnet'

const chainId = process.env.ARC_CHAIN_ID
  ? parseInt(process.env.ARC_CHAIN_ID, 10)
  : ENV === 'mainnet' ? MAINNET_CHAIN_ID : TESTNET_CHAIN_ID

const registryChain = getChain(chainId)
if (!registryChain) throw new Error(`Chain ${chainId} not found in onchain-facts registry`)

const registryUsdc = getUsdc(chainId)
if (!registryUsdc) throw new Error(`USDC not deployed on chain ${chainId} per onchain-facts registry`)

// Build RPC URL: prefer the Arc Studio proxy if this chain is covered; fall back to the
// public endpoint from the registry. Rate limits for the public endpoint are unknown.
function buildRpcUrl(): string {
  const proxyBase = process.env.RPC_PROXY_BASE_URL
  const proxyToken = process.env.RPC_PROXY_TOKEN
  const proxyChains = (process.env.RPC_PROXY_CHAINS ?? '').split(',').map((s) => s.trim())

  // Compass chain key for Arc Testnet is "Arc_Testnet"; for Arc Mainnet it would be "Arc"
  const compassKey = ENV === 'mainnet' ? 'Arc' : 'Arc_Testnet'
  if (proxyBase && proxyToken && proxyChains.includes(compassKey)) {
    return `${proxyBase}/api/rpc/${compassKey}?_rpc_token=${proxyToken}`
  }

  // Fall back to public RPC URL from the registry (rate limits unknown)
  const publicRpc = registryChain.rpcUrls[0]
  if (!publicRpc) throw new Error(`No RPC URL in registry for chain ${chainId}`)
  return publicRpc
}

export const chainConfig: ChainConfig = {
  env: ENV,
  chainId,
  rpcUrl: buildRpcUrl(),
  explorerBase: registryChain.explorerBase,
  usdcAddress: registryUsdc.address,
  usdcDecimals: registryUsdc.decimals,
  treasuryAddress: process.env.TREASURY_ADDRESS ?? null,
  serverSignerKey: process.env.SERVER_SIGNER_PRIVATE_KEY ?? null,
  minWithdrawalAmount: ENV === 'mainnet' ? 5.0 : 1.0,
  requiredConfirmations: ENV === 'mainnet' ? 2 : 1,
}

export function isTestnet(): boolean { return chainConfig.env === 'testnet' }
export function isMainnet(): boolean { return chainConfig.env === 'mainnet' }

/** Throws if treasury wallet is not configured. */
export function requireTreasury(): string {
  if (!chainConfig.treasuryAddress) {
    throw new Error('TREASURY_ADDRESS env var is required for payment operations')
  }
  return chainConfig.treasuryAddress
}

/** Throws if server signer key is not configured. */
export function requireSignerKey(): string {
  if (!chainConfig.serverSignerKey) {
    throw new Error('SERVER_SIGNER_PRIVATE_KEY env var is required for server-side signing')
  }
  return chainConfig.serverSignerKey
}

/** Convert display USDC amount ($90.00) to raw bigint (90000000n, 6 decimals). */
export function usdcToRaw(displayAmount: number): bigint {
  return BigInt(Math.round(displayAmount * 10 ** chainConfig.usdcDecimals))
}

/** Convert raw USDC bigint to display amount. */
export function rawToUsdc(raw: bigint): number {
  return Number(raw) / 10 ** chainConfig.usdcDecimals
}
