'use client'

import { AlertTriangle } from 'lucide-react'
import { useAccount, useSwitchChain } from 'wagmi'

import { ethereumSepolia } from '@/lib/web3/chains'

export function WrongNetworkBanner() {
  const { chainId, isConnected } = useAccount()
  const { isPending, switchChain } = useSwitchChain()
  if (!isConnected || chainId === ethereumSepolia.id) return null

  return (
    <div className="network-banner" role="alert">
      <AlertTriangle size={16} />
      <span>This Agent runs on Ethereum Sepolia.</span>
      <button
        disabled={isPending}
        onClick={() => switchChain({ chainId: ethereumSepolia.id })}
        type="button"
      >
        {isPending ? 'Switching…' : 'Switch to Sepolia'}
      </button>
    </div>
  )
}
