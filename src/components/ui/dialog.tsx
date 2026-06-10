import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

type DialogContextValue = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

function useDialogContext() {
  const context = React.useContext(DialogContext)

  if (!context) {
    throw new Error("Dialog components must be used inside Dialog")
  }

  return context
}

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  React.useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onOpenChange, open])

  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

export function DialogContent({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const { open, onOpenChange } = useDialogContext()

  if (!open) {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-end bg-background/80 p-3 backdrop-blur-sm sm:place-items-center">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close dialog"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 grid max-h-[calc(100svh-1.5rem)] w-full max-w-lg gap-4 overflow-y-auto rounded-[8px] border bg-card p-4 shadow-xl",
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}

export function DialogHeader({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn("grid gap-1.5", className)}>{children}</div>
}

export function DialogTitle({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <h2 className={cn("text-base font-semibold", className)}>{children}</h2>
  )
}

export function DialogDescription({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>
  )
}

export function DialogFooter({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:flex sm:justify-end", className)}>
      {children}
    </div>
  )
}

export function DialogClose({
  children,
  asChild,
}: {
  children: React.ReactElement<{ onClick?: React.MouseEventHandler }>
  asChild?: boolean
}) {
  const { onOpenChange } = useDialogContext()

  if (asChild) {
    return React.cloneElement(children, {
      onClick: (event: React.MouseEvent) => {
        children.props.onClick?.(event)

        if (!event.defaultPrevented) {
          onOpenChange(false)
        }
      },
    })
  }

  return children
}
