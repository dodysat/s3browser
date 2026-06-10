import * as React from "react"
import {
  Database,
  FolderOpen,
  KeyRound,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react"

import { Field, SelectInput, TextInput } from "@/components/form-controls"
import { Button } from "@/components/ui/button"
import type { S3Profile, S3ProfileDraft } from "@/lib/profile-storage"
import type { BucketSummary } from "@/lib/s3"
import { cn } from "@/lib/utils"

type ConnectionPanelProps = {
  isOpen: boolean
  profiles: S3Profile[]
  activeProfile: S3Profile | null
  profileForm: S3ProfileDraft
  bucketName: string
  buckets: BucketSummary[]
  isBucketListLoading: boolean
  isEntryListLoading: boolean
  onSubmit: React.FormEventHandler<HTMLFormElement>
  onClose: () => void
  onNewProfile: () => void
  onSelectProfile: (profile: S3Profile) => void
  onDeleteProfile: (profileId: string) => void
  onBucketNameChange: (bucketName: string) => void
  onRefreshBuckets: () => void
  onOpenBucket: () => void
  onProfileFormChange: (patch: Partial<S3ProfileDraft>) => void
  onSaveProfile: () => void
}

export function ConnectionPanel({
  isOpen,
  profiles,
  activeProfile,
  profileForm,
  bucketName,
  buckets,
  isBucketListLoading,
  isEntryListLoading,
  onSubmit,
  onClose,
  onNewProfile,
  onSelectProfile,
  onDeleteProfile,
  onBucketNameChange,
  onRefreshBuckets,
  onOpenBucket,
  onProfileFormChange,
  onSaveProfile,
}: ConnectionPanelProps) {
  return (
    <aside
      className={cn(
        "fixed inset-0 z-30 min-w-0 bg-background/80 p-3 backdrop-blur-sm lg:static lg:z-auto lg:block lg:bg-transparent lg:p-0 lg:backdrop-blur-none",
        isOpen ? "block" : "hidden"
      )}
    >
      <form
        className="mx-auto grid max-h-[calc(100svh-1.5rem)] max-w-md gap-3 overflow-y-auto rounded-[8px] border bg-card p-3 shadow-xl lg:max-h-none lg:max-w-none lg:overflow-visible lg:shadow-sm"
        onSubmit={onSubmit}
      >
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
                  "grid grid-cols-[minmax(0,1fr)_32px] gap-2 rounded-[8px] border p-2",
                  profile.id === activeProfile?.id && "border-primary/40 bg-muted"
                )}
              >
                <button
                  type="button"
                  className="min-w-0 text-left"
                  onClick={() => onSelectProfile(profile)}
                >
                  <div className="truncate text-sm font-medium">
                    {profile.name}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {profile.endpoint}
                  </div>
                </button>
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

        <div className="grid gap-3 border-t pt-3">
          <h3 className="text-sm font-semibold">Bucket</h3>

          <Field label="Bucket">
            <TextInput
              value={bucketName}
              placeholder="bucket-name"
              onChange={(event) => onBucketNameChange(event.target.value)}
            />
          </Field>

          <Field
            label="Loaded buckets"
            className={cn(buckets.length === 0 && "hidden")}
          >
            <SelectInput
              value={
                buckets.some((bucket) => bucket.name === bucketName)
                  ? bucketName
                  : ""
              }
              disabled={buckets.length === 0}
              onChange={(event) => onBucketNameChange(event.target.value)}
            >
              <option value="">
                {buckets.length === 0 ? "No buckets loaded" : "Select bucket"}
              </option>
              {buckets.map((bucket) => (
                <option key={bucket.name} value={bucket.name}>
                  {bucket.name}
                </option>
              ))}
            </SelectInput>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10"
              disabled={!activeProfile || isBucketListLoading}
              onClick={onRefreshBuckets}
            >
              {isBucketListLoading ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Database />
              )}
              Buckets
            </Button>
            <Button
              type="button"
              className="h-10"
              disabled={!activeProfile || isEntryListLoading}
              onClick={onOpenBucket}
            >
              {isEntryListLoading ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <FolderOpen />
              )}
              Open
            </Button>
          </div>
        </div>

        <div className="grid gap-3">
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
              onChange={(event) =>
                onProfileFormChange({ endpoint: event.target.value })
              }
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Field label="Region">
              <TextInput
                value={profileForm.region}
                placeholder="us-east-1"
                onChange={(event) =>
                  onProfileFormChange({ region: event.target.value })
                }
              />
            </Field>

            <Field label="Default bucket">
              <TextInput
                value={profileForm.bucket}
                placeholder="my-bucket"
                onChange={(event) =>
                  onProfileFormChange({ bucket: event.target.value })
                }
              />
            </Field>
          </div>

          <Field label="Access key ID">
            <TextInput
              value={profileForm.accessKeyId}
              autoComplete="off"
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

        <div className="sticky bottom-0 grid grid-cols-2 gap-2 bg-card pt-1 lg:static lg:bg-transparent lg:pt-0">
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={onSaveProfile}
          >
            <Save />
            Save
          </Button>
          <Button type="submit" className="h-10">
            <KeyRound />
            Connect
          </Button>
        </div>
      </form>
    </aside>
  )
}
