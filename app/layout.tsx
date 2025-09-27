import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import BottomNav from '@/components/navigation/BottomNav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CardSync - クレジットカード管理アプリ',
  description: 'クレジットカードの支出を一元管理し、隠れたサブスクリプションを発見',
  keywords: ['クレジットカード', '家計簿', 'サブスクリプション', '支出管理'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <Providers>
          <div className="pb-16 md:pb-0">{children}</div>
          <BottomNav />
        </Providers>
      </body>
    </html>
  )
}
