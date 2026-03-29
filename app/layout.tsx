import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Lot 5 Barbershop | Queue System',
  description: 'Premium grooming without the wait. Join the digital queue for Lot 5 Barbershop.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="flex flex-col min-h-screen">
        {children}
      </body>
    </html>
  )
}
