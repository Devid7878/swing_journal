import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SwingJournal',
  description: 'NSE Swing Trade & IPO Tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, background: '#0a0b0f', minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  )
}
