/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'
import { requireChain } from './onchain-facts'

// The RPC URL comes from the onchain facts registry, never from viem's built-in default
// (older viem releases point arcTestnet at a retired host that no longer resolves).
const arcRpcUrl = requireChain(arcTestnet.id).rpcUrls[0]
if (!arcRpcUrl) throw new Error('No RPC URL for Arc Testnet in onchain-facts')

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, arcRpcUrl)

export const config = createConfig({
  chains: [arcTestnet, mainnet], // mainnet needed for ENS resolution
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http(arcRpcUrl),
    [mainnet.id]: http(), // ENS resolution uses mainnet
  },
})
