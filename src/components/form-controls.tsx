import * as React from "react"

import { cn } from "@/lib/utils"

export function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn("grid gap-1.5 text-xs font-medium", className)}>
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

export function TextInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 min-w-0 rounded-[8px] border border-input bg-background px-3 text-base outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm",
        className
      )}
      {...props}
    />
  )
}

export function SelectInput({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 min-w-0 rounded-[8px] border border-input bg-background px-3 text-base outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}
