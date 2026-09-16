import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Idea Roadmap Generator",
  description: "Turn a raw idea into a clear, actionable roadmap.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
