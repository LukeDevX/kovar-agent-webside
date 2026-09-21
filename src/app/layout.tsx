import '@rainbow-me/rainbowkit/styles.css'
import '@/styles/globals.css'

import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { Providers } from '@/app/providers'

export const metadata: Metadata = {
  title: 'Kovar Agent',
  description: 'DeepSeek chat with explicit Kovar and wallet tools.',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
