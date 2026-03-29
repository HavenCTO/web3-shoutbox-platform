import { type ReactNode } from 'react'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { mainnet, base, sepolia } from 'wagmi/chains'
import { type AppKitNetwork } from '@reown/appkit/networks'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { createAppKit } from '@reown/appkit/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { env } from '@/config/env'

const projectId = env.VITE_WALLETCONNECT_PROJECT_ID

const chains: [typeof mainnet, typeof base, typeof sepolia] = [mainnet, base, sepolia]
const appKitNetworks: [AppKitNetwork, ...AppKitNetwork[]] = [mainnet, base, sepolia]

const metadata = {
  name: 'Web3 Shoutbox',
  description: 'Decentralized chat powered by XMTP & GunDB',
  url: env.VITE_APP_URL,
  icons: ['/icon.png'],
}

// Module-level initialization — createAppKit must run before components render
let wagmiAdapter: WagmiAdapter | null = null

if (projectId) {
  try {
    wagmiAdapter = new WagmiAdapter({
      networks: appKitNetworks,
      projectId,
      ssr: false,
    })

    createAppKit({
      adapters: [wagmiAdapter],
      networks: appKitNetworks,
      projectId,
      metadata,
      themeMode: 'dark',
      features: { analytics: false },
    })
  } catch (error) {
    console.error('Failed to initialize AppKit:', error)
    wagmiAdapter = null
  }
} else {
  console.warn('VITE_WALLETCONNECT_PROJECT_ID not set. Wallet features unavailable.')
}

const fallbackConfig = createConfig({
  chains,
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [sepolia.id]: http(),
  },
})

const queryClient = new QueryClient()

export function Web3Provider({ children }: { children: ReactNode }) {
  const config = wagmiAdapter?.wagmiConfig ?? fallbackConfig

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
