import * as React from "react"
import {
  ArrowLeft,
  ChevronRight,
  Database,
  ExternalLink,
  File,
  Folder,
  FolderOpen,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  UploadCloud,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { TextInput } from "@/components/form-controls"
import { NoticeBanner } from "@/components/notice-banner"
import { Button } from "@/components/ui/button"
import type { Breadcrumb, Notice, UploadState } from "@/lib/app-types"
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
  uploadState: UploadState | null
  uploadPercent: number | null
  openingKey: string | null
  nextContinuationToken: string | null
  isEntryListLoading: boolean
  uploadInputRef: React.RefObject<HTMLInputElement | null>
  onSearchChange: (query: string) => void
  onRefresh: () => void
  onUploadFiles: React.ChangeEventHandler<HTMLInputElement>
  onEntryOpen: (entry: BrowserEntry) => void
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
  uploadState,
  uploadPercent,
  openingKey,
  nextContinuationToken,
  isEntryListLoading,
  uploadInputRef,
  onSearchChange,
  onRefresh,
  onUploadFiles,
  onEntryOpen,
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
          uploadState={uploadState}
          uploadInputRef={uploadInputRef}
          onSearchChange={onSearchChange}
          onRefresh={onRefresh}
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
        <UploadProgress uploadState={uploadState} uploadPercent={uploadPercent} />

        <ObjectList
          bucketName={bucketName}
          entries={entries}
          filteredEntries={filteredEntries}
          openingKey={openingKey}
          isEntryListLoading={isEntryListLoading}
          onEntryOpen={onEntryOpen}
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
  uploadState,
  uploadInputRef,
  onSearchChange,
  onRefresh,
  onUploadFiles,
}: {
  hasActiveProfile: boolean
  bucketName: string
  searchQuery: string
  isEntryListLoading: boolean
  uploadState: UploadState | null
  uploadInputRef: React.RefObject<HTMLInputElement | null>
  onSearchChange: (query: string) => void
  onRefresh: () => void
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
          size="icon"
          className="size-10"
          aria-label="Upload files"
          disabled={!hasActiveProfile || !bucketName || !!uploadState}
          onClick={() => uploadInputRef.current?.click()}
        >
          {uploadState ? (
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

function UploadProgress({
  uploadState,
  uploadPercent,
}: {
  uploadState: UploadState | null
  uploadPercent: number | null
}) {
  if (!uploadState) {
    return null
  }

  return (
    <div className="grid gap-2 rounded-[8px] border p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="min-w-0 truncate">Uploading {uploadState.fileName}</div>
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
  )
}

function ObjectList({
  bucketName,
  entries,
  filteredEntries,
  openingKey,
  isEntryListLoading,
  onEntryOpen,
}: {
  bucketName: string
  entries: BrowserEntry[]
  filteredEntries: BrowserEntry[]
  openingKey: string | null
  isEntryListLoading: boolean
  onEntryOpen: (entry: BrowserEntry) => void
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
      <div className="hidden grid-cols-[minmax(0,1fr)_120px_180px_48px] gap-3 border-b bg-muted px-3 py-2 text-xs font-medium text-muted-foreground sm:grid">
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
            onOpen={onEntryOpen}
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
  onOpen,
}: {
  entry: BrowserEntry
  isOpening: boolean
  onOpen: (entry: BrowserEntry) => void
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-x-2 gap-y-1 p-3 sm:grid-cols-[minmax(0,1fr)_120px_180px_48px] sm:items-center">
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
    </div>
  )
}
