import * as React from "react"
import {
  Copy,
  KeyRound,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"

import { Field, TextInput } from "@/components/form-controls"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { S3Profile, S3ProfileDraft } from "@/lib/profile-storage"
import { cn } from "@/lib/utils"

type ConnectionPanelProps = {
  isOpen: boolean
  isEditorOpen: boolean
  profiles: S3Profile[]
  activeProfile: S3Profile | null
  profileForm: S3ProfileDraft
  isConnectLoading: boolean
  onSubmit: React.FormEventHandler<HTMLFormElement>
  onClose: () => void
  onEditorOpenChange: (open: boolean) => void
  onNewProfile: () => void
  onConnectProfile: (profile: S3Profile) => void
  onEditProfile: (profile: S3Profile) => void
  onDuplicateProfile: (profile: S3Profile) => void
  onDeleteProfile: (profileId: string) => void
  onProfileFormChange: (patch: Partial<S3ProfileDraft>) => void
}

export function ConnectionPanel({
  isOpen,
  isEditorOpen,
  profiles,
  activeProfile,
  profileForm,
  isConnectLoading,
  onSubmit,
  onClose,
  onEditorOpenChange,
  onNewProfile,
  onConnectProfile,
  onEditProfile,
  onDuplicateProfile,
  onDeleteProfile,
  onProfileFormChange,
}: ConnectionPanelProps) {
  return (
    <>
      <aside
        className={cn(
          "fixed inset-0 z-30 min-w-0 bg-background/80 p-3 backdrop-blur-sm lg:static lg:z-auto lg:block lg:bg-transparent lg:p-0 lg:backdrop-blur-none",
          isOpen ? "block" : "hidden"
        )}
      >
        <div className="mx-auto grid max-h-[calc(100svh-1.5rem)] max-w-md gap-3 overflow-y-auto rounded-[8px] border bg-card p-3 shadow-xl lg:max-h-none lg:max-w-none lg:overflow-visible lg:shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Connections</h2>
              <div className="text-xs text-muted-foreground">
                {profiles.length} saved
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onNewProfile}
            >
              <Plus />
              New
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 lg:hidden"
              aria-label="Close profiles"
              onClick={onClose}
            >
              <X />
            </Button>
          </div>

          <div className="grid gap-2">
            {profiles.length === 0 ? (
              <div className="rounded-[8px] border border-dashed p-3 text-sm text-muted-foreground">
                No saved profiles
              </div>
            ) : (
              profiles.map((profile) => (
                <div
                  key={profile.id}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_32px_32px_32px] gap-2 rounded-[8px] border p-2",
                    profile.id === activeProfile?.id &&
                      "border-primary/40 bg-muted"
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => onConnectProfile(profile)}
                  >
                    <div className="truncate text-sm font-medium">
                      {profile.name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {profile.bucket}
                    </div>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${profile.name}`}
                    onClick={() => onEditProfile(profile)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Duplicate ${profile.name}`}
                    onClick={() => onDuplicateProfile(profile)}
                  >
                    <Copy />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${profile.name}`}
                    onClick={() => onDeleteProfile(profile.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      <ConnectionEditorDialog
        open={isEditorOpen}
        profileForm={profileForm}
        isConnectLoading={isConnectLoading}
        onOpenChange={onEditorOpenChange}
        onSubmit={onSubmit}
        onProfileFormChange={onProfileFormChange}
      />
    </>
  )
}

function ConnectionEditorDialog({
  open,
  profileForm,
  isConnectLoading,
  onOpenChange,
  onSubmit,
  onProfileFormChange,
}: {
  open: boolean
  profileForm: S3ProfileDraft
  isConnectLoading: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: React.FormEventHandler<HTMLFormElement>
  onProfileFormChange: (patch: Partial<S3ProfileDraft>) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Connection</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <Field label="Bucket">
              <TextInput
                value={profileForm.bucket}
                placeholder="bucket-name"
                required
                onChange={(event) =>
                  onProfileFormChange({ bucket: event.target.value })
                }
              />
            </Field>

            <Field label="Profile name">
              <TextInput
                value={profileForm.name}
                placeholder="Production assets"
                onChange={(event) =>
                  onProfileFormChange({ name: event.target.value })
                }
              />
            </Field>

            <Field label="Endpoint">
              <TextInput
                value={profileForm.endpoint}
                placeholder="https://s3.example.com"
                inputMode="url"
                required
                onChange={(event) =>
                  onProfileFormChange({ endpoint: event.target.value })
                }
              />
            </Field>

            <Field label="Region">
              <TextInput
                value={profileForm.region}
                placeholder="us-east-1"
                onChange={(event) =>
                  onProfileFormChange({ region: event.target.value })
                }
              />
            </Field>

            <Field label="Access key ID">
              <TextInput
                value={profileForm.accessKeyId}
                autoComplete="off"
                required
                onChange={(event) =>
                  onProfileFormChange({ accessKeyId: event.target.value })
                }
              />
            </Field>

            <Field label="Secret access key">
              <TextInput
                value={profileForm.secretAccessKey}
                type="password"
                autoComplete="off"
                required
                onChange={(event) =>
                  onProfileFormChange({ secretAccessKey: event.target.value })
                }
              />
            </Field>

            <Field label="Session token">
              <TextInput
                value={profileForm.sessionToken}
                type="password"
                autoComplete="off"
                onChange={(event) =>
                  onProfileFormChange({ sessionToken: event.target.value })
                }
              />
            </Field>

            <label className="flex items-center gap-2 rounded-[8px] border px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={profileForm.forcePathStyle}
                onChange={(event) =>
                  onProfileFormChange({ forcePathStyle: event.target.checked })
                }
              />
              <span>Path-style requests</span>
            </label>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="h-10">
                Close
              </Button>
            </DialogClose>
            <Button type="submit" className="h-10" disabled={isConnectLoading}>
              {isConnectLoading ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <KeyRound />
              )}
              Save & Connect
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
