import * as React from "react"
import {
  ArrowLeft,
  ChevronRight,
  Cloud,
  Database,
  ExternalLink,
  File,
  Folder,
  FolderOpen,
  KeyRound,
  LoaderCircle,
  Monitor,
  Moon,
  PanelLeft,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sun,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { type Theme, useTheme } from "@/components/theme-provider"
import {
  createEmptyProfileDraft,
  createProfile,
  loadActiveProfileId,
  loadProfiles,
  saveActiveProfileId,
  saveProfiles,
  type S3Profile,
  type S3ProfileDraft,
} from "@/lib/profile-storage"
import {
  createPresignedObjectUrl,
  formatS3Error,
  listBuckets,
  listObjects,
  uploadObject,
  type BrowserEntry,
  type BucketSummary,
} from "@/lib/s3"
import { cn } from "@/lib/utils"

type Notice = {
  type: "success" | "error" | "info"
  text: string
}

type UploadState = {
  fileName: string
  loaded: number
  total: number | null
  index: number
  totalFiles: number
}

const THEME_OPTIONS: Array<{
  value: Theme
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
]

function profileToDraft(profile: S3Profile): S3ProfileDraft {
  return {
    name: profile.name,
    endpoint: profile.endpoint,
    region: profile.region,
    accessKeyId: profile.accessKeyId,
    secretAccessKey: profile.secretAccessKey,
    sessionToken: profile.sessionToken,
    bucket: profile.bucket,
    forcePathStyle: profile.forcePathStyle,
  }
}

function formatBytes(value: number) {
  if (value === 0) {
    return "0 B"
  }

  const units = ["B", "KB", "MB", "GB", "TB"]
  const unitIndex = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1
  )
  const scaledValue = value / 1024 ** unitIndex

  return `${scaledValue.toFixed(scaledValue >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

function formatDate(value: Date | null) {
  if (!value) {
    return "--"
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value)
}

function buildBreadcrumbs(prefix: string) {
  const crumbs = [{ label: "Root", prefix: "" }]
  let nextPrefix = ""

  for (const segment of prefix.split("/").filter(Boolean)) {
    nextPrefix += `${segment}/`
    crumbs.push({ label: segment, prefix: nextPrefix })
  }

  return crumbs
}

function normalizeUploadKey(prefix: string, fileName: string) {
  return `${prefix}${fileName}`.replace(/^\/+/, "")
}

function Field({
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

function TextInput({
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

function SelectInput({
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

function NoticeBanner({ notice }: { notice: Notice | null }) {
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

function ThemeSwitcher() {
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

function EmptyState({
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

export function App() {
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null)
  const [profiles, setProfilesState] = React.useState<S3Profile[]>(() =>
    loadProfiles()
  )
  const [activeProfileId, setActiveProfileIdState] = React.useState<
    string | null
  >(() => loadActiveProfileId())
  const initialProfile =
    profiles.find((profile) => profile.id === activeProfileId) ??
    profiles.at(0) ??
    null
  const [editingProfileId, setEditingProfileId] = React.useState<string | null>(
    () => initialProfile?.id ?? null
  )
  const [profileForm, setProfileForm] = React.useState<S3ProfileDraft>(() =>
    initialProfile ? profileToDraft(initialProfile) : createEmptyProfileDraft()
  )
  const [bucketName, setBucketName] = React.useState(
    () => initialProfile?.bucket ?? ""
  )
  const [buckets, setBuckets] = React.useState<BucketSummary[]>([])
  const [currentPrefix, setCurrentPrefix] = React.useState("")
  const [entries, setEntries] = React.useState<BrowserEntry[]>([])
  const [nextContinuationToken, setNextContinuationToken] = React.useState<
    string | null
  >(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [notice, setNotice] = React.useState<Notice | null>(null)
  const [isProfilePanelOpen, setIsProfilePanelOpen] = React.useState(
    () => profiles.length === 0
  )
  const [isBucketListLoading, setIsBucketListLoading] = React.useState(false)
  const [isEntryListLoading, setIsEntryListLoading] = React.useState(false)
  const [openingKey, setOpeningKey] = React.useState<string | null>(null)
  const [uploadState, setUploadState] = React.useState<UploadState | null>(null)
  const [presignedFallback, setPresignedFallback] = React.useState<{
    name: string
    url: string
  } | null>(null)

  const activeProfile = React.useMemo(() => {
    return (
      profiles.find((profile) => profile.id === activeProfileId) ??
      profiles.at(0) ??
      null
    )
  }, [activeProfileId, profiles])

  const filteredEntries = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) {
      return entries
    }

    return entries.filter((entry) =>
      entry.name.toLowerCase().includes(query)
    )
  }, [entries, searchQuery])

  const breadcrumbs = React.useMemo(
    () => buildBreadcrumbs(currentPrefix),
    [currentPrefix]
  )

  const uploadPercent =
    uploadState && uploadState.total
      ? Math.round((uploadState.loaded / uploadState.total) * 100)
      : null

  function commitProfiles(nextProfiles: S3Profile[]) {
    setProfilesState(nextProfiles)
    saveProfiles(nextProfiles)
  }

  function setActiveProfileId(profileId: string | null) {
    setActiveProfileIdState(profileId)
    saveActiveProfileId(profileId)
  }

  function patchProfileForm(patch: Partial<S3ProfileDraft>) {
    setProfileForm((currentDraft) => ({
      ...currentDraft,
      ...patch,
    }))
  }

  function validateDraft() {
    const endpoint = profileForm.endpoint.trim()

    if (!endpoint) {
      return "Endpoint is required."
    }

    try {
      new URL(endpoint)
    } catch {
      return "Endpoint must be a valid URL."
    }

    if (!profileForm.accessKeyId.trim()) {
      return "Access key ID is required."
    }

    if (!profileForm.secretAccessKey) {
      return "Secret access key is required."
    }

    return null
  }

  function persistDraft() {
    const validationError = validateDraft()

    if (validationError) {
      setNotice({ type: "error", text: validationError })
      return null
    }

    const existingProfile = editingProfileId
      ? profiles.find((profile) => profile.id === editingProfileId)
      : null
    const savedProfile = existingProfile
      ? {
          ...createProfile(profileForm),
          id: existingProfile.id,
        }
      : createProfile(profileForm)
    const nextProfiles = existingProfile
      ? profiles.map((profile) =>
          profile.id === existingProfile.id ? savedProfile : profile
        )
      : [...profiles, savedProfile]

    commitProfiles(nextProfiles)
    setEditingProfileId(savedProfile.id)
    setActiveProfileId(savedProfile.id)
    setBucketName(savedProfile.bucket)
    setNotice({ type: "success", text: "Profile saved." })

    return savedProfile
  }

  function rememberBucket(profileId: string, nextBucketName: string) {
    const nextProfiles = profiles.map((profile) =>
      profile.id === profileId ? { ...profile, bucket: nextBucketName } : profile
    )

    commitProfiles(nextProfiles)
    setProfileForm((currentDraft) =>
      editingProfileId === profileId
        ? { ...currentDraft, bucket: nextBucketName }
        : currentDraft
    )
  }

  async function refreshBuckets(profile = activeProfile) {
    if (!profile) {
      setNotice({ type: "error", text: "Save a profile first." })
      return
    }

    setIsBucketListLoading(true)
    setPresignedFallback(null)

    try {
      const nextBuckets = await listBuckets(profile)
      setBuckets(nextBuckets)
      setNotice({
        type: "success",
        text:
          nextBuckets.length > 0
            ? "Buckets loaded."
            : "Bucket list returned no buckets.",
      })
    } catch (error) {
      setBuckets([])
      setNotice({
        type: "error",
        text: `Bucket list failed. Direct bucket entry is still available. ${formatS3Error(error)}`,
      })
    } finally {
      setIsBucketListLoading(false)
    }
  }

  async function loadEntries({
    profile,
    bucket,
    prefix,
    continuationToken,
    append,
  }: {
    profile: S3Profile
    bucket: string
    prefix: string
    continuationToken?: string | null
    append: boolean
  }) {
    setIsEntryListLoading(true)
    setPresignedFallback(null)

    try {
      const listing = await listObjects({
        profile,
        bucket,
        prefix,
        continuationToken,
      })

      setEntries((currentEntries) =>
        append ? [...currentEntries, ...listing.entries] : listing.entries
      )
      setCurrentPrefix(prefix)
      setNextContinuationToken(listing.nextContinuationToken)
      setNotice({
        type: "success",
        text: append ? "More objects loaded." : "Objects loaded.",
      })
    } catch (error) {
      if (!append) {
        setEntries([])
        setNextContinuationToken(null)
      }

      setNotice({
        type: "error",
        text: formatS3Error(error),
      })
    } finally {
      setIsEntryListLoading(false)
    }
  }

  async function openBucket(
    nextBucketName = bucketName,
    profile = activeProfile
  ) {
    const trimmedBucketName = nextBucketName.trim()

    if (!profile) {
      setNotice({ type: "error", text: "Save a profile first." })
      return
    }

    if (!trimmedBucketName) {
      setNotice({ type: "error", text: "Bucket name is required." })
      return
    }

    setBucketName(trimmedBucketName)
    rememberBucket(profile.id, trimmedBucketName)
    await loadEntries({
      profile,
      bucket: trimmedBucketName,
      prefix: "",
      append: false,
    })
  }

  async function handleConnect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const savedProfile = persistDraft()

    if (!savedProfile) {
      return
    }

    setIsProfilePanelOpen(false)
    await refreshBuckets(savedProfile)

    if (savedProfile.bucket) {
      await openBucket(savedProfile.bucket, savedProfile)
    }
  }

  function handleSaveProfile() {
    persistDraft()
  }

  function handleNewProfile() {
    setEditingProfileId(null)
    setProfileForm(createEmptyProfileDraft())
    setBucketName("")
    setBuckets([])
    setEntries([])
    setCurrentPrefix("")
    setNextContinuationToken(null)
    setNotice({ type: "info", text: "New profile ready." })
  }

  function handleSelectProfile(profile: S3Profile) {
    setEditingProfileId(profile.id)
    setProfileForm(profileToDraft(profile))
    setActiveProfileId(profile.id)
    setBucketName(profile.bucket)
    setBuckets([])
    setEntries([])
    setCurrentPrefix("")
    setNextContinuationToken(null)
    setNotice({ type: "info", text: `${profile.name} selected.` })
    setIsProfilePanelOpen(false)
  }

  function handleDeleteProfile(profileId: string) {
    const profile = profiles.find((nextProfile) => nextProfile.id === profileId)

    if (!profile) {
      return
    }

    if (!window.confirm(`Delete profile "${profile.name}"?`)) {
      return
    }

    const nextProfiles = profiles.filter(
      (nextProfile) => nextProfile.id !== profileId
    )

    commitProfiles(nextProfiles)

    const nextActiveProfile = nextProfiles.at(0) ?? null
    setActiveProfileId(nextActiveProfile?.id ?? null)
    setEditingProfileId(nextActiveProfile?.id ?? null)
    setProfileForm(
      nextActiveProfile
        ? profileToDraft(nextActiveProfile)
        : createEmptyProfileDraft()
    )
    setBucketName(nextActiveProfile?.bucket ?? "")
    setBuckets([])
    setEntries([])
    setCurrentPrefix("")
    setNextContinuationToken(null)
    setNotice({ type: "success", text: "Profile deleted." })
  }

  async function handleEntryOpen(entry: BrowserEntry) {
    if (!activeProfile || !bucketName) {
      setNotice({ type: "error", text: "Open a bucket first." })
      return
    }

    if (entry.type === "folder") {
      await loadEntries({
        profile: activeProfile,
        bucket: bucketName,
        prefix: entry.key,
        append: false,
      })
      return
    }

    setOpeningKey(entry.key)
    setPresignedFallback(null)

    try {
      const url = await createPresignedObjectUrl({
        profile: activeProfile,
        bucket: bucketName,
        key: entry.key,
        expiresInSeconds: 3600,
      })
      const openedWindow = window.open(url, "_blank", "noopener,noreferrer")

      if (!openedWindow) {
        setPresignedFallback({ name: entry.name, url })
        setNotice({
          type: "info",
          text: "Presigned URL is ready.",
        })
        return
      }

      setNotice({
        type: "success",
        text: "Presigned URL opened. It expires in 1 hour.",
      })
    } catch (error) {
      setNotice({
        type: "error",
        text: formatS3Error(error),
      })
    } finally {
      setOpeningKey(null)
    }
  }

  async function handleUploadFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""

    if (files.length === 0) {
      return
    }

    if (!activeProfile || !bucketName) {
      setNotice({ type: "error", text: "Open a bucket first." })
      return
    }

    try {
      let uploadedFiles = 0

      for (const [index, file] of files.entries()) {
        const key = normalizeUploadKey(currentPrefix, file.name)
        const alreadyExists = entries.some(
          (entry) => entry.type === "object" && entry.key === key
        )

        if (
          alreadyExists &&
          !window.confirm(`Overwrite "${file.name}" in this prefix?`)
        ) {
          continue
        }

        setUploadState({
          fileName: file.name,
          loaded: 0,
          total: file.size,
          index: index + 1,
          totalFiles: files.length,
        })

        await uploadObject({
          profile: activeProfile,
          bucket: bucketName,
          key,
          file,
          onProgress: (progress) => {
            setUploadState({
              fileName: file.name,
              loaded: progress.loaded,
              total: progress.total,
              index: index + 1,
              totalFiles: files.length,
            })
          },
        })

        uploadedFiles += 1
      }

      setNotice({
        type: "success",
        text:
          uploadedFiles === 1
            ? "1 file uploaded."
            : `${uploadedFiles} files uploaded.`,
      })
      await loadEntries({
        profile: activeProfile,
        bucket: bucketName,
        prefix: currentPrefix,
        append: false,
      })
    } catch (error) {
      setNotice({
        type: "error",
        text: formatS3Error(error),
      })
    } finally {
      setUploadState(null)
    }
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 lg:hidden"
            aria-label="Toggle profiles"
            onClick={() => setIsProfilePanelOpen((isOpen) => !isOpen)}
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

      <main className="mx-auto grid max-w-7xl gap-3 p-3 sm:p-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside
          className={cn(
            "fixed inset-0 z-30 min-w-0 bg-background/80 p-3 backdrop-blur-sm lg:static lg:z-auto lg:block lg:bg-transparent lg:p-0 lg:backdrop-blur-none",
            isProfilePanelOpen ? "block" : "hidden"
          )}
        >
          <form
            className="mx-auto grid max-h-[calc(100svh-1.5rem)] max-w-md gap-3 overflow-y-auto rounded-[8px] border bg-card p-3 shadow-xl lg:max-h-none lg:max-w-none lg:overflow-visible lg:shadow-sm"
            onSubmit={handleConnect}
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
                onClick={handleNewProfile}
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
                onClick={() => setIsProfilePanelOpen(false)}
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
                      profile.id === activeProfile?.id &&
                        "border-primary/40 bg-muted"
                    )}
                  >
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => handleSelectProfile(profile)}
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
                      onClick={() => handleDeleteProfile(profile.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="grid gap-3">
              <Field label="Profile name">
                <TextInput
                  value={profileForm.name}
                  placeholder="Production assets"
                  onChange={(event) =>
                    patchProfileForm({ name: event.target.value })
                  }
                />
              </Field>

              <Field label="Endpoint">
                <TextInput
                  value={profileForm.endpoint}
                  placeholder="https://s3.example.com"
                  inputMode="url"
                  onChange={(event) =>
                    patchProfileForm({ endpoint: event.target.value })
                  }
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <Field label="Region">
                  <TextInput
                    value={profileForm.region}
                    placeholder="us-east-1"
                    onChange={(event) =>
                      patchProfileForm({ region: event.target.value })
                    }
                  />
                </Field>

                <Field label="Default bucket">
                  <TextInput
                    value={profileForm.bucket}
                    placeholder="my-bucket"
                    onChange={(event) =>
                      patchProfileForm({ bucket: event.target.value })
                    }
                  />
                </Field>
              </div>

              <Field label="Access key ID">
                <TextInput
                  value={profileForm.accessKeyId}
                  autoComplete="off"
                  onChange={(event) =>
                    patchProfileForm({ accessKeyId: event.target.value })
                  }
                />
              </Field>

              <Field label="Secret access key">
                <TextInput
                  value={profileForm.secretAccessKey}
                  type="password"
                  autoComplete="off"
                  onChange={(event) =>
                    patchProfileForm({ secretAccessKey: event.target.value })
                  }
                />
              </Field>

              <Field label="Session token">
                <TextInput
                  value={profileForm.sessionToken}
                  type="password"
                  autoComplete="off"
                  onChange={(event) =>
                    patchProfileForm({ sessionToken: event.target.value })
                  }
                />
              </Field>

              <label className="flex items-center gap-2 rounded-[8px] border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={profileForm.forcePathStyle}
                  onChange={(event) =>
                    patchProfileForm({ forcePathStyle: event.target.checked })
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
                onClick={handleSaveProfile}
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

        <section className="grid min-w-0 gap-3">
          <div className="grid gap-3 rounded-[8px] border bg-card p-3 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <Field label="Bucket">
                  <TextInput
                    value={bucketName}
                    placeholder="bucket-name"
                    onChange={(event) => setBucketName(event.target.value)}
                  />
                </Field>

                <Field
                  label="Loaded buckets"
                  className={cn(buckets.length === 0 && "hidden sm:grid")}
                >
                  <SelectInput
                    value={buckets.some((bucket) => bucket.name === bucketName) ? bucketName : ""}
                    disabled={buckets.length === 0}
                    onChange={(event) => setBucketName(event.target.value)}
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
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10"
                  disabled={!activeProfile || isBucketListLoading}
                  onClick={() => refreshBuckets()}
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
                  onClick={() => openBucket()}
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

            <div className="flex flex-wrap items-center gap-1.5">
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={crumb.prefix || "root"}>
                  {index > 0 ? (
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  ) : null}
                  <Button
                    type="button"
                    variant={index === breadcrumbs.length - 1 ? "secondary" : "ghost"}
                    size="sm"
                    disabled={!activeProfile || !bucketName || isEntryListLoading}
                    onClick={() =>
                      activeProfile &&
                      bucketName &&
                      loadEntries({
                        profile: activeProfile,
                        bucket: bucketName,
                        prefix: crumb.prefix,
                        append: false,
                      })
                    }
                  >
                    {index === 0 ? <ArrowLeft /> : null}
                    {crumb.label}
                  </Button>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="grid gap-3 rounded-[8px] border bg-card p-3 shadow-sm">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <TextInput
                  className="pl-9"
                  value={searchQuery}
                  placeholder="Filter current prefix"
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10"
                  disabled={!activeProfile || !bucketName || isEntryListLoading}
                  onClick={() =>
                    activeProfile &&
                    bucketName &&
                    loadEntries({
                      profile: activeProfile,
                      bucket: bucketName,
                      prefix: currentPrefix,
                      append: false,
                    })
                  }
                >
                  {isEntryListLoading ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <RefreshCw />
                  )}
                  Refresh
                </Button>
                <Button
                  type="button"
                  className="h-10"
                  disabled={!activeProfile || !bucketName || !!uploadState}
                  onClick={() => uploadInputRef.current?.click()}
                >
                  {uploadState ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <UploadCloud />
                  )}
                  Upload
                </Button>
                <input
                  ref={uploadInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleUploadFiles}
                />
              </div>
            </div>

            <NoticeBanner notice={notice} />

            {presignedFallback ? (
              <a
                className="flex min-w-0 items-center gap-2 rounded-[8px] border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:underline dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
                href={presignedFallback.url}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="size-4 shrink-0" />
                <span className="truncate">{presignedFallback.name}</span>
              </a>
            ) : null}

            {uploadState ? (
              <div className="grid gap-2 rounded-[8px] border p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0 truncate">
                    Uploading {uploadState.fileName}
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">
                    {uploadState.index}/{uploadState.totalFiles}
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{
                      width: `${uploadPercent ?? 15}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}

            {!bucketName ? (
              <EmptyState
                icon={Database}
                title="No bucket open"
                text="Select a saved profile and open a bucket."
              />
            ) : filteredEntries.length === 0 && !isEntryListLoading ? (
              <EmptyState
                icon={FolderOpen}
                title={entries.length === 0 ? "Prefix is empty" : "No matches"}
                text={
                  entries.length === 0
                    ? "Upload files or choose another prefix."
                    : "Adjust the filter."
                }
              />
            ) : (
              <div className="overflow-hidden rounded-[8px] border">
                <div className="hidden grid-cols-[minmax(0,1fr)_120px_180px_48px] gap-3 border-b bg-muted px-3 py-2 text-xs font-medium text-muted-foreground sm:grid">
                  <div>Name</div>
                  <div>Size</div>
                  <div>Modified</div>
                  <div />
                </div>
                <div className="divide-y">
                  {filteredEntries.map((entry) => {
                    const isOpening = openingKey === entry.key

                    return (
                      <div
                        key={`${entry.type}:${entry.key}`}
                        className="grid grid-cols-[minmax(0,1fr)_44px] gap-x-2 gap-y-1 p-3 sm:grid-cols-[minmax(0,1fr)_120px_180px_48px] sm:items-center"
                      >
                        <button
                          type="button"
                          className="col-start-1 flex min-w-0 items-center gap-3 text-left"
                          onClick={() => handleEntryOpen(entry)}
                        >
                          <span
                            className={cn(
                              "grid size-9 shrink-0 place-items-center rounded-[8px]",
                              entry.type === "folder"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                            )}
                          >
                            {entry.type === "folder" ? (
                              <Folder className="size-4" />
                            ) : (
                              <File className="size-4" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {entry.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {entry.key}
                            </span>
                          </span>
                        </button>

                        <div className="col-start-1 pl-12 text-xs text-muted-foreground sm:col-auto sm:pl-0 sm:text-sm">
                          {entry.type === "object"
                            ? formatBytes(entry.size)
                            : "Folder"}
                        </div>
                        <div className="col-start-1 pl-12 text-xs text-muted-foreground sm:col-auto sm:pl-0 sm:text-sm">
                          {entry.type === "object"
                            ? formatDate(entry.lastModified)
                            : "--"}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="col-start-2 row-span-3 row-start-1 size-10 self-center justify-self-end sm:col-auto sm:row-auto sm:size-8"
                          aria-label={
                            entry.type === "folder"
                              ? `Open ${entry.name}`
                              : `Open presigned URL for ${entry.name}`
                          }
                          disabled={isOpening}
                          onClick={() => handleEntryOpen(entry)}
                        >
                          {isOpening ? (
                            <LoaderCircle className="animate-spin" />
                          ) : entry.type === "folder" ? (
                            <ChevronRight />
                          ) : (
                            <ExternalLink />
                          )}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {nextContinuationToken ? (
              <Button
                type="button"
                variant="outline"
                disabled={!activeProfile || !bucketName || isEntryListLoading}
                onClick={() =>
                  activeProfile &&
                  bucketName &&
                  loadEntries({
                    profile: activeProfile,
                    bucket: bucketName,
                    prefix: currentPrefix,
                    continuationToken: nextContinuationToken,
                    append: true,
                  })
                }
              >
                {isEntryListLoading ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Plus />
                )}
                Load more
              </Button>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
