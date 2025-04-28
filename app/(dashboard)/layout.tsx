import type React from "react"
import { NavBar } from "@/components/nav-bar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <NavBar />
      <main className="flex-1">{children}</main>
    </div>
  )
}
