"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <button className="h-9 w-9 animate-pulse rounded-xl border border-border/80 bg-background/70 dark:bg-white/5" />
  }

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title="切换亮/暗色主题"
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background/70 text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground dark:border-white/10 dark:bg-white/6 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-50"
    >
      {isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
