import type { Notice } from "@/lib/app-types"
import { cn } from "@/lib/utils"

export function NoticeBanner({ notice }: { notice: Notice | null }) {
  if (!notice) {
    return null
  }

  return (
    <div
      className={cn(
        "rounded-[8px] border px-3 py-2 text-sm",
        notice.type === "error" &&
          "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
        notice.type === "success" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
        notice.type === "info" &&
          "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
      )}
    >
      {notice.text}
    </div>
  )
}
