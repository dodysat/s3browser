import * as React from "react"

export function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  text: string
}) {
  return (
    <div className="grid min-h-56 place-items-center rounded-[8px] border border-dashed p-6 text-center">
      <div className="grid max-w-sm gap-2 justify-items-center">
        <Icon className="size-8 text-muted-foreground" />
        <div className="text-sm font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{text}</div>
      </div>
    </div>
  )
}
