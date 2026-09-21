import { getAddress, type Address } from 'viem'

const DEFAULT_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com'
const DEFAULT_AXUSD_ADDRESS = '0x7E36fAAdF4FBF1566549d60aa73355ed15DaecEc'

export const appConfig = {
  name: 'Kovar Agent',
  description: 'DeepSeek chat with explicit Kovar and wallet tools',
  chainId: Number(process.env.NEXT_PUBLIC_EVM_CHAIN_ID ?? '11155111'),
  rpcUrl: process.env.NEXT_PUBLIC_EVM_RPC_URL ?? DEFAULT_RPC_URL,
  axusdAddress: getAddress(
    process.env.NEXT_PUBLIC_AXUSD_ADDRESS ?? DEFAULT_AXUSD_ADDRESS,
  ) as Address,
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '',
} as const

if (appConfig.chainId !== 11155111) {
  throw new Error('NEXT_PUBLIC_EVM_CHAIN_ID must be Ethereum Sepolia (11155111)')
}
