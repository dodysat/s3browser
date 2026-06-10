import { Cloud, PanelLeft } from "lucide-react"

import { ThemeSwitcher } from "@/components/theme-switcher"
import { Button } from "@/components/ui/button"
import type { S3Profile } from "@/lib/profile-storage"

export function AppHeader({
  activeProfile,
  bucketName,
  onToggleProfiles,
}: {
  activeProfile: S3Profile | null
  bucketName: string
  onToggleProfiles: () => void
}) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto grid max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 lg:hidden"
          aria-label="Toggle profiles"
          onClick={onToggleProfiles}
        >
          <PanelLeft />
        </Button>

        <div className="flex min-w-0 items-center gap-2">
          <div className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-primary text-primary-foreground max-[360px]:hidden">
            <Cloud className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">S3 Browser</h1>
            <div className="truncate text-xs text-muted-foreground">
              {activeProfile
                ? `${activeProfile.name}${bucketName ? ` / ${bucketName}` : ""}`
                : "No profile"}
            </div>
          </div>
        </div>

        <ThemeSwitcher />
      </div>
    </header>
  )
}
