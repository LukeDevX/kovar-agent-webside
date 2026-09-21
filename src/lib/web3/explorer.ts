import type { Hash } from 'viem'

export function transactionUrl(hash: Hash): string {
  return `https://sepolia.etherscan.io/tx/${hash}`
}
