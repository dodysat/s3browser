import * as React from "react"

import { AppHeader } from "@/components/app-header"
import { ConnectionPanel } from "@/components/connection-panel"
import { ObjectBrowser } from "@/components/object-browser"
import type { Notice, UploadState } from "@/lib/app-types"
import {
  createRouteKey,
  normalizeRoutePrefix,
  parseBucketRoute,
  writeBucketRoute,
} from "@/lib/bucket-route"
import {
  buildBreadcrumbs,
  normalizeUploadKey,
  profileToDraft,
} from "@/lib/file-browser"
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
  type ObjectListingCacheInfo,
} from "@/lib/s3"

type LoadEntriesOptions = {
  profile: S3Profile
  bucket: string
  prefix: string
  continuationToken?: string | null
  append: boolean
  routeMode?: "push" | "replace" | "none"
  cacheMode?: "allow" | "reload"
}

export function App() {
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null)
  const lastHandledRouteRef = React.useRef<string | null>(null)
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
  const [objectListingCacheInfo, setObjectListingCacheInfo] =
    React.useState<ObjectListingCacheInfo | null>(null)
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
    setNotice(null)

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
      setNotice(null)
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

  const loadEntries = React.useCallback(async function loadEntries({
    profile,
    bucket,
    prefix,
    continuationToken,
    append,
    routeMode = "none",
    cacheMode = "allow",
  }: LoadEntriesOptions) {
    setIsEntryListLoading(true)
    setPresignedFallback(null)
    const normalizedPrefix = normalizeRoutePrefix(prefix)

    if (!append && routeMode !== "none") {
      lastHandledRouteRef.current = createRouteKey({
        bucket,
        prefix: normalizedPrefix,
      })
      writeBucketRoute(bucket, normalizedPrefix, routeMode)
    }

    try {
      const listing = await listObjects({
        profile,
        bucket,
        prefix: normalizedPrefix,
        continuationToken,
        cacheMode,
      })

      setEntries((currentEntries) =>
        append ? [...currentEntries, ...listing.entries] : listing.entries
      )
      setCurrentPrefix(normalizedPrefix)
      setNextContinuationToken(listing.nextContinuationToken)
      setObjectListingCacheInfo(listing.cacheInfo)
      setNotice(null)
    } catch (error) {
      if (!append) {
        setEntries([])
        setNextContinuationToken(null)
        setObjectListingCacheInfo(null)
      }

      setNotice({
        type: "error",
        text: formatS3Error(error),
      })
    } finally {
      setIsEntryListLoading(false)
    }
  }, [])

  React.useEffect(() => {
    const route = parseBucketRoute()

    if (!route) {
      return
    }

    const routeKey = createRouteKey(route)

    if (activeProfile && lastHandledRouteRef.current === routeKey) {
      return
    }

    queueMicrotask(() => {
      if (!activeProfile) {
        setBucketName(route.bucket)
        setCurrentPrefix(route.prefix)
        setNotice({ type: "error", text: "Save a profile first." })
        return
      }

      lastHandledRouteRef.current = routeKey
      setBucketName(route.bucket)
      setSearchQuery("")
      void loadEntries({
        profile: activeProfile,
        bucket: route.bucket,
        prefix: route.prefix,
        append: false,
      })
    })
  }, [activeProfile, loadEntries])

  React.useEffect(() => {
    const handlePopState = () => {
      const route = parseBucketRoute()

      if (!route) {
        lastHandledRouteRef.current = null
        setEntries([])
        setCurrentPrefix("")
        setNextContinuationToken(null)
        setObjectListingCacheInfo(null)
        setNotice(null)
        return
      }

      lastHandledRouteRef.current = createRouteKey(route)
      setBucketName(route.bucket)
      setSearchQuery("")

      if (!activeProfile) {
        setEntries([])
        setCurrentPrefix(route.prefix)
        setNextContinuationToken(null)
        setObjectListingCacheInfo(null)
        setNotice({ type: "error", text: "Save a profile first." })
        return
      }

      void loadEntries({
        profile: activeProfile,
        bucket: route.bucket,
        prefix: route.prefix,
        append: false,
      })
    }

    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [activeProfile, loadEntries])

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
      routeMode: "push",
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
    setObjectListingCacheInfo(null)
    setNotice(null)
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
    setObjectListingCacheInfo(null)
    setNotice(null)
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
    setObjectListingCacheInfo(null)
    setNotice(null)
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
        routeMode: "push",
      })
      return
    }

    setOpeningKey(entry.key)
    setPresignedFallback(null)
    const openedWindow = window.open("about:blank", "_blank")

    if (openedWindow) {
      openedWindow.opener = null
    }

    try {
      const url = await createPresignedObjectUrl({
        profile: activeProfile,
        bucket: bucketName,
        key: entry.key,
        expiresInSeconds: 3600,
      })

      if (!openedWindow) {
        setPresignedFallback({ name: entry.name, url })
        setNotice(null)
        return
      }

      openedWindow.location.href = url
      setNotice(null)
    } catch (error) {
      openedWindow?.close()
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
      }

      setNotice(null)
      await loadEntries({
        profile: activeProfile,
        bucket: bucketName,
        prefix: currentPrefix,
        append: false,
        cacheMode: "reload",
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

  function refreshCurrentPrefix() {
    if (!activeProfile || !bucketName) {
      return
    }

    void loadEntries({
      profile: activeProfile,
      bucket: bucketName,
      prefix: currentPrefix,
      append: false,
      cacheMode: "reload",
    })
  }

  function openBreadcrumbPrefix(prefix: string) {
    if (!activeProfile || !bucketName) {
      return
    }

    void loadEntries({
      profile: activeProfile,
      bucket: bucketName,
      prefix,
      append: false,
      routeMode: "push",
    })
  }

  function loadMoreEntries() {
    if (!activeProfile || !bucketName || !nextContinuationToken) {
      return
    }

    void loadEntries({
      profile: activeProfile,
      bucket: bucketName,
      prefix: currentPrefix,
      continuationToken: nextContinuationToken,
      append: true,
    })
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <AppHeader
        activeProfile={activeProfile}
        bucketName={bucketName}
        onToggleProfiles={() => setIsProfilePanelOpen((isOpen) => !isOpen)}
      />

      <main className="mx-auto grid max-w-7xl gap-3 p-3 sm:p-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
        <ConnectionPanel
          isOpen={isProfilePanelOpen}
          profiles={profiles}
          activeProfile={activeProfile}
          profileForm={profileForm}
          bucketName={bucketName}
          buckets={buckets}
          isBucketListLoading={isBucketListLoading}
          isEntryListLoading={isEntryListLoading}
          onSubmit={(event) => {
            void handleConnect(event)
          }}
          onClose={() => setIsProfilePanelOpen(false)}
          onNewProfile={handleNewProfile}
          onSelectProfile={handleSelectProfile}
          onDeleteProfile={handleDeleteProfile}
          onBucketNameChange={setBucketName}
          onRefreshBuckets={() => {
            void refreshBuckets()
          }}
          onOpenBucket={() => {
            void openBucket()
          }}
          onProfileFormChange={patchProfileForm}
          onSaveProfile={handleSaveProfile}
        />

        <ObjectBrowser
          hasActiveProfile={!!activeProfile}
          bucketName={bucketName}
          entries={entries}
          filteredEntries={filteredEntries}
          breadcrumbs={breadcrumbs}
          searchQuery={searchQuery}
          notice={notice}
          objectListingCacheInfo={objectListingCacheInfo}
          presignedFallback={presignedFallback}
          uploadState={uploadState}
          uploadPercent={uploadPercent}
          openingKey={openingKey}
          nextContinuationToken={nextContinuationToken}
          isEntryListLoading={isEntryListLoading}
          uploadInputRef={uploadInputRef}
          onSearchChange={setSearchQuery}
          onRefresh={refreshCurrentPrefix}
          onUploadFiles={(event) => {
            void handleUploadFiles(event)
          }}
          onEntryOpen={(entry) => {
            void handleEntryOpen(entry)
          }}
          onBreadcrumbOpen={openBreadcrumbPrefix}
          onLoadMore={loadMoreEntries}
        />
      </main>
    </div>
  )
}

export default App
