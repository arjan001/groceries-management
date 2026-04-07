import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: 'Snackoh Bakers',
  description: 'Fresh baked goods delivered to your door — Snackoh Bakers',
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <head>
        <meta name="theme-color" content="#ea580c" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
