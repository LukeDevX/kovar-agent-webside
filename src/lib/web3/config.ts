import { createConfig, http } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'

import { appConfig } from '@/config/app'
import { ethereumSepolia } from '@/lib/web3/chains'

const connectors = [
  injected({ shimDisconnect: true }),
  ...(appConfig.walletConnectProjectId
    ? [
        walletConnect({
          projectId: appConfig.walletConnectProjectId,
          metadata: {
            name: appConfig.name,
            description: appConfig.description,
            url: typeof window === 'undefined' ? 'https://localhost' : window.location.origin,
            icons: [],
          },
          showQrModal: false,
        }),
      ]
    : []),
]

export const wagmiConfig = createConfig({
  chains: [ethereumSepolia],
  connectors,
  transports: { [ethereumSepolia.id]: http(appConfig.rpcUrl) },
  ssr: true,
  multiInjectedProviderDiscovery: true,
})
