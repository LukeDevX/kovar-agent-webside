'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ChevronDown, Wallet } from 'lucide-react'

export function ConnectWalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted
        const connected = ready && account && chain
        if (!connected) {
          return (
            <button className="wallet-button" onClick={openConnectModal} type="button">
              <Wallet size={16} /> Connect wallet
            </button>
          )
        }
        if (chain.unsupported) {
          return (
            <button className="wallet-button wallet-button--warning" onClick={openChainModal} type="button">
              Wrong network
            </button>
          )
        }
        return (
          <button className="wallet-button" onClick={openAccountModal} type="button">
            <span className="wallet-dot" />
            {account.displayName}
            <ChevronDown size={14} />
          </button>
        )
      }}
    </ConnectButton.Custom>
  )
}
