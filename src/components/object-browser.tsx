import * as React from "react"
import {
  ArrowLeft,
  CircleAlert,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  ExternalLink,
  File,
  Folder,
  FolderPlus,
  FolderOpen,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { TextInput } from "@/components/form-controls"
import { NoticeBanner } from "@/components/notice-banner"
import { Button } from "@/components/ui/button"
import type { Breadcrumb, Notice, UploadTask, WakeLockState } from "@/lib/app-types"
import { formatBytes, formatDate } from "@/lib/file-browser"
import type { BrowserEntry, ObjectListingCacheInfo } from "@/lib/s3"
import { cn } from "@/lib/utils"

type ObjectBrowserProps = {
  hasActiveProfile: boolean
  bucketName: string
  entries: BrowserEntry[]
  filteredEntries: BrowserEntry[]
  breadcrumbs: Breadcrumb[]
  searchQuery: string
  notice: Notice | null
  objectListingCacheInfo: ObjectListingCacheInfo | null
  presignedFallback: { name: string; url: string } | null
  uploadTasks: UploadTask[]
  hasActiveUploads: boolean
  activeUploadCount: number
  wakeLockState: WakeLockState
  openingKey: string | null
  deletingKey: string | null
  isFolderCreating: boolean
  nextContinuationToken: string | null
  isEntryListLoading: boolean
  uploadInputRef: React.RefObject<HTMLInputElement | null>
  onSearchChange: (query: string) => void
  onRefresh: () => void
  onCreateFolder: () => void
  onUploadFiles: React.ChangeEventHandler<HTMLInputElement>
  onEntryOpen: (entry: BrowserEntry) => void
  onEntryDelete: (entry: BrowserEntry) => void
  onBreadcrumbOpen: (prefix: string) => void
  onLoadMore: () => void
}

export function ObjectBrowser({
  hasActiveProfile,
  bucketName,
  entries,
  filteredEntries,
  breadcrumbs,
  searchQuery,
  notice,
  objectListingCacheInfo,
  presignedFallback,
  uploadTasks,
  hasActiveUploads,
  activeUploadCount,
  wakeLockState,
  openingKey,
  deletingKey,
  isFolderCreating,
  nextContinuationToken,
  isEntryListLoading,
  uploadInputRef,
  onSearchChange,
  onRefresh,
  onCreateFolder,
  onUploadFiles,
  onEntryOpen,
  onEntryDelete,
  onBreadcrumbOpen,
  onLoadMore,
}: ObjectBrowserProps) {
  return (
    <section className="grid min-w-0 gap-3">
      <div className="grid content-start gap-3 rounded-[8px] border bg-card p-3 shadow-sm">
        <ObjectToolbar
          hasActiveProfile={hasActiveProfile}
          bucketName={bucketName}
          searchQuery={searchQuery}
          isEntryListLoading={isEntryListLoading}
          isFolderCreating={isFolderCreating}
          hasActiveUploads={hasActiveUploads}
          uploadInputRef={uploadInputRef}
          onSearchChange={onSearchChange}
          onRefresh={onRefresh}
          onCreateFolder={onCreateFolder}
          onUploadFiles={onUploadFiles}
        />

        <Breadcrumbs
          breadcrumbs={breadcrumbs}
          hasActiveProfile={hasActiveProfile}
          bucketName={bucketName}
          isEntryListLoading={isEntryListLoading}
          onOpen={onBreadcrumbOpen}
        />

        <NoticeBanner notice={notice} />
        <PresignedFallbackLink fallback={presignedFallback} />
        <UploadQueue
          tasks={uploadTasks}
          activeUploadCount={activeUploadCount}
          wakeLockState={wakeLockState}
        />

        <ObjectList
          bucketName={bucketName}
          entries={entries}
          filteredEntries={filteredEntries}
          openingKey={openingKey}
          deletingKey={deletingKey}
          isEntryListLoading={isEntryListLoading}
          onEntryOpen={onEntryOpen}
          onEntryDelete={onEntryDelete}
        />

        {nextContinuationToken ? (
          <Button
            type="button"
            variant="outline"
            disabled={!hasActiveProfile || !bucketName || isEntryListLoading}
            onClick={onLoadMore}
          >
            {isEntryListLoading ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Plus />
            )}
            Load more
          </Button>
        ) : null}

        <CacheAge cacheInfo={objectListingCacheInfo} />
      </div>
    </section>
  )
}

function ObjectToolbar({
  hasActiveProfile,
  bucketName,
  searchQuery,
  isEntryListLoading,
  isFolderCreating,
  hasActiveUploads,
  uploadInputRef,
  onSearchChange,
  onRefresh,
  onCreateFolder,
  onUploadFiles,
}: {
  hasActiveProfile: boolean
  bucketName: string
  searchQuery: string
  isEntryListLoading: boolean
  isFolderCreating: boolean
  hasActiveUploads: boolean
  uploadInputRef: React.RefObject<HTMLInputElement | null>
  onSearchChange: (query: string) => void
  onRefresh: () => void
  onCreateFolder: () => void
  onUploadFiles: React.ChangeEventHandler<HTMLInputElement>
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(220px,360px)_auto] sm:justify-start">
      <div className="relative min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <TextInput
          className="w-full pl-9"
          value={searchQuery}
          placeholder="Filter current prefix"
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10"
          aria-label="Refresh objects"
          disabled={!hasActiveProfile || !bucketName || isEntryListLoading}
          onClick={onRefresh}
        >
          {isEntryListLoading ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <RefreshCw />
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10"
          aria-label="Create folder"
          disabled={!hasActiveProfile || !bucketName || isFolderCreating}
          onClick={onCreateFolder}
        >
          {isFolderCreating ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <FolderPlus />
          )}
        </Button>
        <Button
          type="button"
          size="icon"
          className="size-10"
          aria-label="Upload files"
          disabled={!hasActiveProfile || !bucketName || hasActiveUploads}
          onClick={() => uploadInputRef.current?.click()}
        >
          {hasActiveUploads ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <UploadCloud />
          )}
        </Button>
        <input
          ref={uploadInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onUploadFiles}
        />
      </div>
    </div>
  )
}

function Breadcrumbs({
  breadcrumbs,
  hasActiveProfile,
  bucketName,
  isEntryListLoading,
  onOpen,
}: {
  breadcrumbs: Breadcrumb[]
  hasActiveProfile: boolean
  bucketName: string
  isEntryListLoading: boolean
  onOpen: (prefix: string) => void
}) {
  return (
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
            disabled={!hasActiveProfile || !bucketName || isEntryListLoading}
            onClick={() => onOpen(crumb.prefix)}
          >
            {index === 0 ? <ArrowLeft /> : null}
            {crumb.label}
          </Button>
        </React.Fragment>
      ))}
    </div>
  )
}

function PresignedFallbackLink({
  fallback,
}: {
  fallback: { name: string; url: string } | null
}) {
  if (!fallback) {
    return null
  }

  return (
    <a
      className="flex min-w-0 items-center gap-2 rounded-[8px] border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:underline dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
      href={fallback.url}
      target="_blank"
      rel="noreferrer"
    >
      <ExternalLink className="size-4 shrink-0" />
      <span className="truncate">{fallback.name}</span>
    </a>
  )
}

function UploadQueue({
  tasks,
  activeUploadCount,
  wakeLockState,
}: {
  tasks: UploadTask[]
  activeUploadCount: number
  wakeLockState: WakeLockState
}) {
  const [now, setNow] = React.useState(() => Date.now())
  const hasActiveTasks = tasks.some(
    (task) => task.status === "queued" || task.status === "uploading"
  )

  React.useEffect(() => {
    if (!hasActiveTasks) {
      return
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [hasActiveTasks])

  if (tasks.length === 0) {
    return null
  }

  const finishedCount = tasks.filter(
    (task) => task.status === "success" || task.status === "error"
  ).length
  const failedCount = tasks.filter((task) => task.status === "error").length

  return (
    <div className="grid gap-3 rounded-[8px] border p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="min-w-0 font-medium">
          Uploads {finishedCount}/{tasks.length}
        </div>
        <div
          className={cn(
            "shrink-0 rounded-full px-2 py-1 text-xs",
            wakeLockState.status === "active"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
              : "bg-muted text-muted-foreground"
          )}
        >
          {wakeLockState.text}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {activeUploadCount > 0
          ? `${activeUploadCount} active or queued`
          : failedCount > 0
            ? `${failedCount} failed`
            : "All uploads complete"}
      </div>
      <div className="grid gap-2">
        {tasks.map((task) => (
          <UploadTaskRow key={task.id} task={task} now={now} />
        ))}
      </div>
    </div>
  )
}

function UploadTaskRow({ task, now }: { task: UploadTask; now: number }) {
  const percent = clampPercent(
    task.total ? Math.round((task.loaded / task.total) * 100) : null
  )
  const elapsedSeconds =
    task.status === "uploading"
      ? Math.max((now - task.startedAt) / 1000, 0)
      : Math.max((task.updatedAt - task.startedAt) / 1000, 0)
  const uploadSpeed = elapsedSeconds > 0 ? task.loaded / elapsedSeconds : 0
  const remainingBytes = task.total ? Math.max(task.total - task.loaded, 0) : null
  const remainingSeconds =
    task.status === "uploading" && remainingBytes !== null && uploadSpeed > 0
      ? Math.ceil(remainingBytes / uploadSpeed)
      : null

  return (
    <div className="grid gap-2 rounded-[8px] bg-muted/40 p-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="min-w-0 truncate text-sm font-medium">
          {task.fileName}
        </div>
        <UploadTaskStatusBadge task={task} />
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{percent !== null ? `${percent}%` : "Preparing"}</span>
        <span>{formatBytes(task.loaded)} uploaded</span>
        {task.total ? <span>of {formatBytes(task.total)}</span> : null}
        {task.status === "uploading" ? (
          <>
            <span>{formatUploadSpeed(uploadSpeed)}</span>
            <span>{formatUploadEta(remainingSeconds)}</span>
          </>
        ) : null}
        {task.status === "error" && task.error ? (
          <span className="text-destructive">{task.error}</span>
        ) : null}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-background">
        <div
          className={cn(
            "h-full transition-all",
            task.status === "error" ? "bg-destructive" : "bg-emerald-500"
          )}
          style={{
            width: `${percent ?? (task.status === "queued" ? 0 : 15)}%`,
          }}
        />
      </div>
    </div>
  )
}

function UploadTaskStatusBadge({ task }: { task: UploadTask }) {
  if (task.status === "success") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-600 dark:text-emerald-300">
        <CheckCircle2 className="size-3" />
        Done
      </span>
    )
  }

  if (task.status === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs text-destructive">
        <CircleAlert className="size-3" />
        Error
      </span>
    )
  }

  if (task.status === "queued") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-1 text-xs text-muted-foreground">
        <Clock3 className="size-3" />
        Queued
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-1 text-xs text-blue-600 dark:text-blue-300">
      <LoaderCircle className="size-3 animate-spin" />
      Uploading
    </span>
  )
}

function formatUploadSpeed(bytesPerSecond: number) {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond < 1) {
    return "0 B/s"
  }

  return `${formatBytes(bytesPerSecond)}/s`
}

function clampPercent(percent: number | null) {
  if (percent === null) {
    return null
  }

  return Math.min(100, Math.max(0, percent))
}

function formatUploadEta(seconds: number | null) {
  if (seconds === null) {
    return "Estimating"
  }

  if (seconds <= 0) {
    return "Done"
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60

    return `${hours}h ${remainingMinutes}m left`
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s left`
  }

  return `${remainingSeconds}s left`
}

function ObjectList({
  bucketName,
  entries,
  filteredEntries,
  openingKey,
  deletingKey,
  isEntryListLoading,
  onEntryOpen,
  onEntryDelete,
}: {
  bucketName: string
  entries: BrowserEntry[]
  filteredEntries: BrowserEntry[]
  openingKey: string | null
  deletingKey: string | null
  isEntryListLoading: boolean
  onEntryOpen: (entry: BrowserEntry) => void
  onEntryDelete: (entry: BrowserEntry) => void
}) {
  if (!bucketName) {
    return (
      <EmptyState
        icon={Database}
        title="No bucket open"
        text="Select a saved profile and open a bucket."
      />
    )
  }

  if (filteredEntries.length === 0 && !isEntryListLoading) {
    return (
      <EmptyState
        icon={FolderOpen}
        title={entries.length === 0 ? "Prefix is empty" : "No matches"}
        text={
          entries.length === 0
            ? "Upload files or choose another prefix."
            : "Adjust the filter."
        }
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-[8px] border">
      <div className="hidden grid-cols-[minmax(0,1fr)_120px_180px_88px] gap-3 border-b bg-muted px-3 py-2 text-xs font-medium text-muted-foreground sm:grid">
        <div>Name</div>
        <div>Size</div>
        <div>Modified</div>
        <div />
      </div>
      <div className="divide-y">
        {filteredEntries.map((entry) => (
          <ObjectRow
            key={`${entry.type}:${entry.key}`}
            entry={entry}
            isOpening={openingKey === entry.key}
            isDeleting={deletingKey === entry.key}
            onOpen={onEntryOpen}
            onDelete={onEntryDelete}
          />
        ))}
      </div>
    </div>
  )
}

function CacheAge({
  cacheInfo,
}: {
  cacheInfo: ObjectListingCacheInfo | null
}) {
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    if (!cacheInfo) {
      return
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 60 * 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [cacheInfo])

  if (!cacheInfo) {
    return null
  }

  return (
    <div className="border-t pt-2 text-center text-xs text-muted-foreground">
      Cache age: {formatElapsedTime(now - cacheInfo.cachedAt)}
    </div>
  )
}

function formatElapsedTime(valueMs: number) {
  const seconds = Math.max(0, Math.floor(valueMs / 1000))

  if (seconds < 60) {
    return "just now"
  }

  const minutes = Math.floor(seconds / 60)

  if (minutes < 60) {
    return minutes === 1 ? "1 minute" : `${minutes} minutes`
  }

  const hours = Math.floor(minutes / 60)

  return hours === 1 ? "1 hour" : `${hours} hours`
}

function ObjectRow({
  entry,
  isOpening,
  isDeleting,
  onOpen,
  onDelete,
}: {
  entry: BrowserEntry
  isOpening: boolean
  isDeleting: boolean
  onOpen: (entry: BrowserEntry) => void
  onDelete: (entry: BrowserEntry) => void
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_40px_40px] gap-x-2 gap-y-1 p-3 sm:grid-cols-[minmax(0,1fr)_120px_180px_88px] sm:items-center">
      <button
        type="button"
        className="col-start-1 flex min-w-0 items-center gap-3 text-left"
        onClick={() => onOpen(entry)}
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

      <div
        className={cn(
          "col-start-1 pl-12 text-xs text-muted-foreground sm:col-auto sm:pl-0 sm:text-sm",
          entry.type === "folder" && "hidden sm:block"
        )}
      >
        {entry.type === "object" ? formatBytes(entry.size) : "Folder"}
      </div>
      <div
        className={cn(
          "col-start-1 pl-12 text-xs text-muted-foreground sm:col-auto sm:pl-0 sm:text-sm",
          entry.type === "folder" && "hidden sm:block"
        )}
      >
        {entry.type === "object" ? formatDate(entry.lastModified) : "--"}
      </div>
      <div className="col-span-2 col-start-2 row-span-3 row-start-1 flex items-center justify-end gap-1 self-center sm:col-auto sm:col-span-1 sm:row-auto">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 sm:size-8"
          aria-label={
            entry.type === "folder"
              ? `Open ${entry.name}`
              : `Open presigned URL for ${entry.name}`
          }
          disabled={isOpening || isDeleting}
          onClick={() => onOpen(entry)}
        >
          {isOpening ? (
            <LoaderCircle className="animate-spin" />
          ) : entry.type === "folder" ? (
            <ChevronRight />
          ) : (
            <ExternalLink />
          )}
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="size-10 sm:size-8"
          aria-label={
            entry.type === "folder"
              ? `Delete folder ${entry.name}`
              : `Delete file ${entry.name}`
          }
          disabled={isOpening || isDeleting}
          onClick={() => onDelete(entry)}
        >
          {isDeleting ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <Trash2 />
          )}
        </Button>
      </div>
    </div>
  )
}
