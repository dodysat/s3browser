import * as React from "react"

import { AppHeader } from "@/components/app-header"
import {
  ConfirmActionDialog,
  FolderNameDialog,
  MessageDialog,
  type ConfirmDialogState,
  type FolderNameDialogState,
  type MessageDialogState,
} from "@/components/app-dialogs"
import { ConnectionPanel } from "@/components/connection-panel"
import { ObjectBrowser } from "@/components/object-browser"
import type { Notice, UploadTask, WakeLockState } from "@/lib/app-types"
import {
  createRouteKey,
  normalizeRoutePrefix,
  parseBucketRoute,
  parseShareRoute,
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
  createFolder,
  deleteEmptyFolder,
  deleteObject,
  formatS3Error,
  listObjects,
  uploadObject,
  type BrowserEntry,
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

type UploadItem = {
  id: string
  file: File
  key: string
}

type WakeLockSentinelLike = EventTarget & {
  released: boolean
  release: () => Promise<void>
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>
  }
}

const UPLOAD_CONCURRENCY = 3

export function App() {
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null)
  const lastHandledRouteRef = React.useRef<string | null>(null)
  const wakeLockRef = React.useRef<WakeLockSentinelLike | null>(null)
  const confirmDialogResolverRef = React.useRef<
    ((confirmed: boolean) => void) | null
  >(null)
  const messageDialogResolverRef = React.useRef<(() => void) | null>(null)
  const folderNameDialogResolverRef = React.useRef<
    ((folderName: string | null) => void) | null
  >(null)
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
  const [isConnectionEditorOpen, setIsConnectionEditorOpen] = React.useState(
    () => profiles.length === 0
  )
  const [isEntryListLoading, setIsEntryListLoading] = React.useState(false)
  const [isFolderCreating, setIsFolderCreating] = React.useState(false)
  const [openingKey, setOpeningKey] = React.useState<string | null>(null)
  const [deletingKey, setDeletingKey] = React.useState<string | null>(null)
  const [uploadTasks, setUploadTasks] = React.useState<UploadTask[]>([])
  const [wakeLockState, setWakeLockState] = React.useState<WakeLockState>({
    status: "idle",
    text: "Keep awake inactive",
  })
  const [presignedFallback, setPresignedFallback] = React.useState<{
    name: string
    url: string
  } | null>(null)
  const [confirmDialog, setConfirmDialog] =
    React.useState<ConfirmDialogState | null>(null)
  const [messageDialog, setMessageDialog] =
    React.useState<MessageDialogState | null>(null)
  const [folderNameDialog, setFolderNameDialog] =
    React.useState<FolderNameDialogState | null>(null)

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

  const hasActiveUploads = uploadTasks.some(
    (task) => task.status === "queued" || task.status === "uploading"
  )

  const activeUploadCount = uploadTasks.filter(
    (task) => task.status === "queued" || task.status === "uploading"
  ).length

  function requestConfirm(dialog: ConfirmDialogState) {
    return new Promise<boolean>((resolve) => {
      confirmDialogResolverRef.current = resolve
      setConfirmDialog(dialog)
    })
  }

  function settleConfirmDialog(confirmed: boolean) {
    const resolve = confirmDialogResolverRef.current

    confirmDialogResolverRef.current = null
    setConfirmDialog(null)
    resolve?.(confirmed)
  }

  function showMessageDialog(dialog: MessageDialogState) {
    return new Promise<void>((resolve) => {
      messageDialogResolverRef.current = resolve
      setMessageDialog(dialog)
    })
  }

  function closeMessageDialog() {
    const resolve = messageDialogResolverRef.current

    messageDialogResolverRef.current = null
    setMessageDialog(null)
    resolve?.()
  }

  function requestFolderName() {
    return new Promise<string | null>((resolve) => {
      folderNameDialogResolverRef.current = resolve
      setFolderNameDialog({ value: "", error: null })
    })
  }

  function settleFolderNameDialog(folderName: string | null) {
    const resolve = folderNameDialogResolverRef.current

    folderNameDialogResolverRef.current = null
    setFolderNameDialog(null)
    resolve?.(folderName)
  }

  function handleFolderNameDialogValueChange(value: string) {
    setFolderNameDialog((currentDialog) =>
      currentDialog ? { ...currentDialog, value, error: null } : currentDialog
    )
  }

  function handleFolderNameDialogSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!folderNameDialog) {
      return
    }

    const folderName = folderNameDialog.value.trim().replace(/^\/+|\/+$/g, "")

    if (!folderName) {
      setFolderNameDialog({ ...folderNameDialog, error: "Folder name is required." })
      return
    }

    if (folderName.includes("/")) {
      setFolderNameDialog({
        ...folderNameDialog,
        error: "Folder name cannot contain slash characters.",
      })
      return
    }

    if (folderName === "." || folderName === "..") {
      setFolderNameDialog({
        ...folderNameDialog,
        error: "Folder name is not allowed.",
      })
      return
    }

    const folderKey = `${currentPrefix}${folderName}/`.replace(/^\/+/, "")

    if (entries.some((entry) => entry.key === folderKey)) {
      setFolderNameDialog({
        ...folderNameDialog,
        error: `Folder "${folderName}" already exists.`,
      })
      return
    }

    settleFolderNameDialog(folderName)
  }

  function createUploadTaskId(index: number) {
    if ("randomUUID" in crypto) {
      return crypto.randomUUID()
    }

    return `upload-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`
  }

  function updateUploadTask(taskId: string, patch: Partial<UploadTask>) {
    setUploadTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? { ...task, ...patch } : task
      )
    )
  }

  const requestWakeLock = React.useCallback(async function requestWakeLock() {
    const navigatorWithWakeLock = navigator as NavigatorWithWakeLock

    if (wakeLockRef.current && !wakeLockRef.current.released) {
      setWakeLockState({
        status: "active",
        text: "Keep awake active",
      })
      return
    }

    if (!navigatorWithWakeLock.wakeLock) {
      setWakeLockState({
        status: "unavailable",
        text: "Keep awake unavailable",
      })
      return
    }

    if (document.visibilityState !== "visible") {
      setWakeLockState({
        status: "released",
        text: "Keep awake released",
      })
      return
    }

    try {
      const wakeLock = await navigatorWithWakeLock.wakeLock.request("screen")

      wakeLockRef.current = wakeLock
      wakeLock.addEventListener("release", () => {
        if (wakeLockRef.current === wakeLock) {
          wakeLockRef.current = null
          setWakeLockState({
            status: "released",
            text: "Keep awake released",
          })
        }
      })
      setWakeLockState({
        status: "active",
        text: "Keep awake active",
      })
    } catch {
      wakeLockRef.current = null
      setWakeLockState({
        status: "unavailable",
        text: "Keep awake unavailable",
      })
    }
  }, [])

  const releaseWakeLock = React.useCallback(async function releaseWakeLock() {
    const wakeLock = wakeLockRef.current

    wakeLockRef.current = null

    if (wakeLock && !wakeLock.released) {
      try {
        await wakeLock.release()
      } catch {
        // Wake locks can be revoked by the browser or OS; no recovery needed.
      }
    }

    setWakeLockState((currentState) =>
      currentState.status === "unavailable"
        ? currentState
        : {
            status: "released",
            text: "Keep awake released",
          }
    )
  }, [])

  React.useEffect(() => {
    if (!hasActiveUploads) {
      return
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [hasActiveUploads, requestWakeLock])

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

  function resetConnectionEditor() {
    const profile =
      (editingProfileId
        ? profiles.find((nextProfile) => nextProfile.id === editingProfileId)
        : null) ??
      activeProfile ??
      profiles.at(0) ??
      null

    setEditingProfileId(profile?.id ?? null)
    setProfileForm(profile ? profileToDraft(profile) : createEmptyProfileDraft())
  }

  function handleConnectionEditorOpenChange(open: boolean) {
    setIsConnectionEditorOpen(open)

    if (!open) {
      resetConnectionEditor()
    }
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

    if (!profileForm.bucket.trim()) {
      return "Bucket is required."
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
    setProfilesState((currentProfiles) => {
      const nextProfiles = currentProfiles.map((profile) =>
        profile.id === profileId
          ? { ...profile, bucket: nextBucketName }
          : profile
      )

      saveProfiles(nextProfiles)

      return nextProfiles
    })
    setProfileForm((currentDraft) =>
      editingProfileId === profileId
        ? { ...currentDraft, bucket: nextBucketName }
        : currentDraft
    )
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
    const shareRoute = parseShareRoute()

    if (!shareRoute) {
      return
    }

    queueMicrotask(() => {
      try {
        new URL(shareRoute.endpoint)
      } catch {
        window.history.replaceState(null, "", "/")
        setNotice({
          type: "error",
          text: "Shared endpoint must be a valid URL.",
        })
        setMessageDialog({
          title: "Invalid Share Link",
          description: "Shared endpoint must be a valid URL.",
        })
        return
      }

      const existingProfile = profiles.find(
        (profile) =>
          profile.endpoint === shareRoute.endpoint &&
          profile.accessKeyId === shareRoute.accessKeyId &&
          profile.bucket === shareRoute.bucket
      )
      const sharedProfile = existingProfile
        ? {
            ...existingProfile,
            name: shareRoute.name,
            endpoint: shareRoute.endpoint,
            region: shareRoute.region,
            accessKeyId: shareRoute.accessKeyId,
            secretAccessKey: shareRoute.secretAccessKey,
            sessionToken: shareRoute.sessionToken,
            bucket: shareRoute.bucket,
            forcePathStyle: shareRoute.forcePathStyle,
          }
        : createProfile({
            name: shareRoute.name,
            endpoint: shareRoute.endpoint,
            region: shareRoute.region,
            accessKeyId: shareRoute.accessKeyId,
            secretAccessKey: shareRoute.secretAccessKey,
            sessionToken: shareRoute.sessionToken,
            bucket: shareRoute.bucket,
            forcePathStyle: shareRoute.forcePathStyle,
          })
      const nextProfiles = existingProfile
        ? profiles.map((profile) =>
            profile.id === existingProfile.id ? sharedProfile : profile
          )
        : [...profiles, sharedProfile]
      const routeKey = createRouteKey({
        bucket: shareRoute.bucket,
        prefix: shareRoute.prefix,
      })

      setProfilesState(nextProfiles)
      saveProfiles(nextProfiles)
      setActiveProfileIdState(sharedProfile.id)
      saveActiveProfileId(sharedProfile.id)
      setEditingProfileId(sharedProfile.id)
      setProfileForm(profileToDraft(sharedProfile))
      setBucketName(sharedProfile.bucket)
      setSearchQuery("")
      setEntries([])
      setCurrentPrefix("")
      setNextContinuationToken(null)
      setObjectListingCacheInfo(null)
      setNotice(null)
      setIsConnectionEditorOpen(false)
      setIsProfilePanelOpen(false)

      lastHandledRouteRef.current = routeKey
      void loadEntries({
        profile: sharedProfile,
        bucket: shareRoute.bucket,
        prefix: shareRoute.prefix,
        append: false,
        routeMode: "replace",
        cacheMode: "reload",
      })
    })
  }, [loadEntries, profiles])

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

    setIsConnectionEditorOpen(false)
    setIsProfilePanelOpen(false)
    await openBucket(savedProfile.bucket, savedProfile)
  }

  function handleNewProfile() {
    setEditingProfileId(null)
    setProfileForm(createEmptyProfileDraft())
    setNotice(null)
    setIsConnectionEditorOpen(true)
  }

  async function handleConnectProfile(profile: S3Profile) {
    setEditingProfileId(profile.id)
    setProfileForm(profileToDraft(profile))
    setActiveProfileId(profile.id)
    setBucketName(profile.bucket)
    setEntries([])
    setCurrentPrefix("")
    setNextContinuationToken(null)
    setObjectListingCacheInfo(null)
    setNotice(null)
    setIsConnectionEditorOpen(false)
    setIsProfilePanelOpen(false)
    await openBucket(profile.bucket, profile)
  }

  function handleEditProfile(profile: S3Profile) {
    setEditingProfileId(profile.id)
    setProfileForm(profileToDraft(profile))
    setNotice(null)
    setIsConnectionEditorOpen(true)
  }

  function createDuplicateProfileName(profileName: string) {
    const baseName = `${profileName} copy`

    if (!profiles.some((profile) => profile.name === baseName)) {
      return baseName
    }

    let copyIndex = 2
    let nextName = `${baseName} ${copyIndex}`

    while (profiles.some((profile) => profile.name === nextName)) {
      copyIndex += 1
      nextName = `${baseName} ${copyIndex}`
    }

    return nextName
  }

  function handleDuplicateProfile(profile: S3Profile) {
    const duplicatedProfile = createProfile({
      ...profileToDraft(profile),
      name: createDuplicateProfileName(profile.name),
    })
    const nextProfiles = [...profiles, duplicatedProfile]

    commitProfiles(nextProfiles)
    setEditingProfileId(duplicatedProfile.id)
    setProfileForm(profileToDraft(duplicatedProfile))
    setNotice(null)
    setIsConnectionEditorOpen(true)
  }

  async function handleDeleteProfile(profileId: string) {
    const profile = profiles.find((nextProfile) => nextProfile.id === profileId)

    if (!profile) {
      return
    }

    const confirmed = await requestConfirm({
      title: "Delete Connection",
      description: `Delete saved connection "${profile.name}"? This removes the local profile only.`,
      confirmLabel: "Delete",
      destructive: true,
    })

    if (!confirmed) {
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
    setEntries([])
    setCurrentPrefix("")
    setNextContinuationToken(null)
    setObjectListingCacheInfo(null)
    setNotice(null)
    setIsConnectionEditorOpen(false)
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

  async function handleCreateFolder() {
    if (!activeProfile || !bucketName) {
      setNotice({ type: "error", text: "Open a bucket first." })
      return
    }

    const folderName = await requestFolderName()

    if (!folderName) {
      return
    }

    const folderKey = `${currentPrefix}${folderName}/`.replace(/^\/+/, "")

    setIsFolderCreating(true)
    setPresignedFallback(null)

    try {
      await createFolder({
        profile: activeProfile,
        bucket: bucketName,
        key: folderKey,
      })
      setNotice(null)
      await loadEntries({
        profile: activeProfile,
        bucket: bucketName,
        prefix: currentPrefix,
        append: false,
        cacheMode: "reload",
      })
    } catch (error) {
      const message = formatS3Error(error)

      setNotice({ type: "error", text: message })
      await showMessageDialog({
        title: "Create Folder Failed",
        description: message,
      })
    } finally {
      setIsFolderCreating(false)
    }
  }

  async function handleEntryDelete(entry: BrowserEntry) {
    if (!activeProfile || !bucketName) {
      setNotice({ type: "error", text: "Open a bucket first." })
      return
    }

    const entryLabel = entry.type === "folder" ? "folder" : "file"
    const confirmed = await requestConfirm({
      title: entry.type === "folder" ? "Delete Folder" : "Delete File",
      description:
        entry.type === "folder"
          ? `Delete empty folder "${entry.name}"? Folders with contents cannot be deleted.`
          : `Delete file "${entry.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    })

    if (!confirmed) {
      return
    }

    setDeletingKey(entry.key)
    setPresignedFallback(null)

    try {
      if (entry.type === "folder") {
        await deleteEmptyFolder({
          profile: activeProfile,
          bucket: bucketName,
          key: entry.key,
        })
      } else {
        await deleteObject({
          profile: activeProfile,
          bucket: bucketName,
          key: entry.key,
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
      const message = formatS3Error(error)
      const title =
        entry.type === "folder" && message.toLowerCase().includes("not empty")
          ? "Folder Not Empty"
          : `Delete ${entryLabel.charAt(0).toUpperCase()}${entryLabel.slice(1)} Failed`

      setNotice({ type: "error", text: message })
      await showMessageDialog({
        title,
        description: message,
      })
    } finally {
      setDeletingKey(null)
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

    const uploadProfile = activeProfile
    const uploadBucket = bucketName
    const uploadPrefix = currentPrefix

    if (hasActiveUploads) {
      setNotice({ type: "error", text: "Uploads are already running." })
      return
    }

    const uploadItems: UploadItem[] = []

    for (const [index, file] of files.entries()) {
      const key = normalizeUploadKey(uploadPrefix, file.name)
      const alreadyExists = entries.some(
        (entry) => entry.type === "object" && entry.key === key
      )

      if (alreadyExists) {
        const confirmed = await requestConfirm({
          title: "Overwrite File",
          description: `Replace "${file.name}" in the current prefix?`,
          confirmLabel: "Overwrite",
        })

        if (!confirmed) {
          continue
        }
      }

      uploadItems.push({
        id: createUploadTaskId(index),
        file,
        key,
      })
    }

    if (uploadItems.length === 0) {
      return
    }

    const queuedAt = Date.now()

    setUploadTasks(
      uploadItems.map((item) => ({
        id: item.id,
        fileName: item.file.name,
        key: item.key,
        loaded: 0,
        total: item.file.size,
        startedAt: queuedAt,
        updatedAt: queuedAt,
        completedAt: null,
        status: "queued",
        error: null,
      }))
    )
    setNotice(null)
    void requestWakeLock()

    let nextUploadIndex = 0
    let failedUploadCount = 0

    async function runUploadItem(item: UploadItem) {
      const uploadStartedAt = Date.now()

      updateUploadTask(item.id, {
        status: "uploading",
        startedAt: uploadStartedAt,
        updatedAt: uploadStartedAt,
      })

      try {
        await uploadObject({
          profile: uploadProfile,
          bucket: uploadBucket,
          key: item.key,
          file: item.file,
          onProgress: (progress) => {
            updateUploadTask(item.id, {
              loaded: progress.loaded,
              total: progress.total ?? item.file.size,
              updatedAt: Date.now(),
            })
          },
        })

        const completedAt = Date.now()

        updateUploadTask(item.id, {
          loaded: item.file.size,
          total: item.file.size,
          updatedAt: completedAt,
          completedAt,
          status: "success",
          error: null,
        })
      } catch (error) {
        failedUploadCount += 1

        const completedAt = Date.now()

        updateUploadTask(item.id, {
          updatedAt: completedAt,
          completedAt,
          status: "error",
          error: formatS3Error(error),
        })
      }
    }

    try {
      const workers = Array.from(
        { length: Math.min(UPLOAD_CONCURRENCY, uploadItems.length) },
        async () => {
          while (nextUploadIndex < uploadItems.length) {
            const uploadItem = uploadItems[nextUploadIndex]
            nextUploadIndex += 1

            if (uploadItem) {
              await runUploadItem(uploadItem)
            }
          }
        }
      )

      await Promise.all(workers)

      if (failedUploadCount > 0) {
        setNotice({
          type: "error",
          text: `${failedUploadCount} of ${uploadItems.length} uploads failed.`,
        })
      } else {
        setNotice(null)
      }

      await loadEntries({
        profile: uploadProfile,
        bucket: uploadBucket,
        prefix: uploadPrefix,
        append: false,
        cacheMode: "reload",
      })
    } catch (error) {
      const message = formatS3Error(error)

      setNotice({ type: "error", text: message })
    } finally {
      await releaseWakeLock()
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
          isEditorOpen={isConnectionEditorOpen}
          profiles={profiles}
          activeProfile={activeProfile}
          profileForm={profileForm}
          isConnectLoading={isEntryListLoading}
          onSubmit={(event) => {
            void handleConnect(event)
          }}
          onClose={() => setIsProfilePanelOpen(false)}
          onEditorOpenChange={handleConnectionEditorOpenChange}
          onNewProfile={handleNewProfile}
          onConnectProfile={(profile) => {
            void handleConnectProfile(profile)
          }}
          onEditProfile={handleEditProfile}
          onDuplicateProfile={handleDuplicateProfile}
          onDeleteProfile={handleDeleteProfile}
          onProfileFormChange={patchProfileForm}
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
          uploadTasks={uploadTasks}
          hasActiveUploads={hasActiveUploads}
          activeUploadCount={activeUploadCount}
          wakeLockState={wakeLockState}
          openingKey={openingKey}
          deletingKey={deletingKey}
          isFolderCreating={isFolderCreating}
          nextContinuationToken={nextContinuationToken}
          isEntryListLoading={isEntryListLoading}
          uploadInputRef={uploadInputRef}
          onSearchChange={setSearchQuery}
          onRefresh={refreshCurrentPrefix}
          onCreateFolder={() => {
            void handleCreateFolder()
          }}
          onUploadFiles={(event) => {
            void handleUploadFiles(event)
          }}
          onEntryOpen={(entry) => {
            void handleEntryOpen(entry)
          }}
          onEntryDelete={(entry) => {
            void handleEntryDelete(entry)
          }}
          onBreadcrumbOpen={openBreadcrumbPrefix}
          onLoadMore={loadMoreEntries}
          onClearUploads={() => setUploadTasks([])}
        />
      </main>

      <FolderNameDialog
        dialog={folderNameDialog}
        onValueChange={handleFolderNameDialogValueChange}
        onCancel={() => settleFolderNameDialog(null)}
        onSubmit={handleFolderNameDialogSubmit}
      />
      <ConfirmActionDialog
        dialog={confirmDialog}
        onCancel={() => settleConfirmDialog(false)}
        onConfirm={() => settleConfirmDialog(true)}
      />
      <MessageDialog dialog={messageDialog} onClose={closeMessageDialog} />
    </div>
  )
}

export default App
