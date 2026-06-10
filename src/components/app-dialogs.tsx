import * as React from "react"

import { Field, TextInput } from "@/components/form-controls"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type ConfirmDialogState = {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

export type MessageDialogState = {
  title: string
  description: string
  actionLabel?: string
}

export type FolderNameDialogState = {
  value: string
  error: string | null
}

export function ConfirmActionDialog({
  dialog,
  onCancel,
  onConfirm,
}: {
  dialog: ConfirmDialogState | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog
      open={!!dialog}
      onOpenChange={(open) => {
        if (!open) {
          onCancel()
        }
      }}
    >
      {dialog ? (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog.title}</DialogTitle>
            <DialogDescription>{dialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              {dialog.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              type="button"
              variant={dialog.destructive ? "destructive" : "default"}
              onClick={onConfirm}
            >
              {dialog.confirmLabel ?? "Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

export function MessageDialog({
  dialog,
  onClose,
}: {
  dialog: MessageDialogState | null
  onClose: () => void
}) {
  return (
    <Dialog
      open={!!dialog}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      {dialog ? (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog.title}</DialogTitle>
            <DialogDescription>{dialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="grid-cols-1">
            <Button type="button" onClick={onClose}>
              {dialog.actionLabel ?? "OK"}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

export function FolderNameDialog({
  dialog,
  onValueChange,
  onCancel,
  onSubmit,
}: {
  dialog: FolderNameDialogState | null
  onValueChange: (value: string) => void
  onCancel: () => void
  onSubmit: React.FormEventHandler<HTMLFormElement>
}) {
  return (
    <Dialog
      open={!!dialog}
      onOpenChange={(open) => {
        if (!open) {
          onCancel()
        }
      }}
    >
      {dialog ? (
        <DialogContent>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>New Folder</DialogTitle>
              <DialogDescription>
                Create a folder in the current prefix.
              </DialogDescription>
            </DialogHeader>
            <Field label="Folder name">
              <TextInput
                autoFocus
                value={dialog.value}
                aria-invalid={dialog.error ? true : undefined}
                onChange={(event) => onValueChange(event.target.value)}
              />
              {dialog.error ? (
                <span className="text-xs text-destructive">
                  {dialog.error}
                </span>
              ) : null}
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
