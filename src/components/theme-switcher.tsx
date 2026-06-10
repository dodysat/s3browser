import type * as React from "react"
import { Monitor, Moon, Sun } from "lucide-react"

import { type Theme, useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"

const THEME_OPTIONS: Array<{
  value: Theme
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
]

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const currentThemeIndex = Math.max(
    THEME_OPTIONS.findIndex((option) => option.value === theme),
    0
  )
  const currentTheme = THEME_OPTIONS[currentThemeIndex]
  const nextTheme = THEME_OPTIONS[(currentThemeIndex + 1) % THEME_OPTIONS.length]
  const CurrentThemeIcon = currentTheme.icon

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-10"
      aria-label={`Theme: ${currentTheme.label}. Switch to ${nextTheme.label.toLowerCase()} theme`}
      onClick={() => setTheme(nextTheme.value)}
    >
      <CurrentThemeIcon />
    </Button>
  )
}
