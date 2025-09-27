"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, ListChecks, Repeat, Settings } from "lucide-react"
import { clsx } from "clsx"

type Item = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const items: Item[] = [
  { href: "/(dashboard)/dashboard", label: "ダッシュボード", icon: Home },
  { href: "/transactions", label: "取引", icon: ListChecks },
  { href: "/subscriptions", label: "サブスク", icon: Repeat },
  { href: "/me", label: "設定", icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-neutral-900/80 dark:supports-[backdrop-filter]:bg-neutral-900/60 md:hidden"
      role="navigation"
      aria-label="メインナビゲーション"
    >
      <div className="mx-auto max-w-screen-sm">
        <ul className="grid grid-cols-4">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname?.startsWith(href)
            return (
              <li key={href} className="">
                <Link
                  href={href}
                  className={clsx(
                    "flex h-14 items-center justify-center gap-1.5 text-[11px]",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    active ? "text-blue-600 dark:text-blue-400" : "text-neutral-600 dark:text-neutral-300"
                  )}
                >
                  <Icon className={clsx("h-5 w-5", active ? "" : "opacity-80")} />
                  <span className="leading-none">{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
        {/* iOS Safe Area */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </nav>
  )
}

export default BottomNav

