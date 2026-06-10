import {
  GetObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3"
import { Upload } from "@aws-sdk/lib-storage"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import type { S3Profile } from "@/lib/profile-storage"

export type BucketSummary = {
  name: string
  createdAt: Date | null
}

export type FolderEntry = {
  type: "folder"
  key: string
  name: string
}

export type ObjectEntry = {
  type: "object"
  key: string
  name: string
  size: number
  lastModified: Date | null
  storageClass: string
}

export type BrowserEntry = FolderEntry | ObjectEntry

export type ObjectListing = {
  entries: BrowserEntry[]
  nextContinuationToken: string | null
  cacheInfo: ObjectListingCacheInfo
}

export type ObjectListingCacheInfo = {
  cachedAt: number
  expiresAt: number
  source: "cache" | "network"
}

type CachedObjectEntry = Omit<ObjectEntry, "lastModified"> & {
  lastModified: string | null
}

type CachedBrowserEntry = FolderEntry | CachedObjectEntry

type CachedObjectListing = {
  entries: CachedBrowserEntry[]
  nextContinuationToken: string | null
}

type ObjectListingCacheRecord = {
  cachedAt: number
  expiresAt: number
  listing: CachedObjectListing
}

type ObjectListingCacheStore = Record<string, ObjectListingCacheRecord>

export type UploadProgress = {
  loaded: number
  total: number | null
}

const OBJECT_LISTING_CACHE_STORAGE_KEY = "s3browser:object-listings:v1"
const OBJECT_LISTING_CACHE_TTL_MS = 60 * 60 * 1000

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "")
}

function createClient(profile: S3Profile) {
  return new S3Client({
    region: profile.region,
    endpoint: trimTrailingSlash(profile.endpoint),
    forcePathStyle: profile.forcePathStyle,
    credentials: {
      accessKeyId: profile.accessKeyId,
      secretAccessKey: profile.secretAccessKey,
      sessionToken: profile.sessionToken || undefined,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  })
}

function getEntryName(key: string, parentPrefix: string) {
  const localName = key.slice(parentPrefix.length).replace(/\/$/, "")
  return localName.split("/").filter(Boolean).at(-1) ?? localName
}

function sortEntries(entries: BrowserEntry[]) {
  return entries.sort((leftEntry, rightEntry) => {
    if (leftEntry.type !== rightEntry.type) {
      return leftEntry.type === "folder" ? -1 : 1
    }

    return leftEntry.name.localeCompare(rightEntry.name, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  })
}

function canUseObjectListingCache() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function getObjectListingCacheStore() {
  if (!canUseObjectListingCache()) {
    return {}
  }

  try {
    const rawStore = window.localStorage.getItem(OBJECT_LISTING_CACHE_STORAGE_KEY)

    if (!rawStore) {
      return {}
    }

    const parsedStore: unknown = JSON.parse(rawStore)

    if (!parsedStore || typeof parsedStore !== "object" || Array.isArray(parsedStore)) {
      window.localStorage.removeItem(OBJECT_LISTING_CACHE_STORAGE_KEY)
      return {}
    }

    return parsedStore as ObjectListingCacheStore
  } catch {
    window.localStorage.removeItem(OBJECT_LISTING_CACHE_STORAGE_KEY)
    return {}
  }
}

function saveObjectListingCacheStore(store: ObjectListingCacheStore) {
  if (!canUseObjectListingCache()) {
    return
  }

  try {
    window.localStorage.setItem(
      OBJECT_LISTING_CACHE_STORAGE_KEY,
      JSON.stringify(store)
    )
  } catch {
    // If quota is full, listing still works; it just skips cache persistence.
  }
}

function createObjectListingCacheKey({
  profile,
  bucket,
  prefix,
  continuationToken,
}: {
  profile: S3Profile
  bucket: string
  prefix: string
  continuationToken?: string | null
}) {
  return JSON.stringify({
    profileId: profile.id,
    endpoint: trimTrailingSlash(profile.endpoint),
    region: profile.region,
    accessKeyId: profile.accessKeyId,
    forcePathStyle: profile.forcePathStyle,
    bucket,
    prefix,
    continuationToken: continuationToken || "",
  })
}

function isMatchingObjectListingCacheKey({
  cacheKey,
  profile,
  bucket,
  prefix,
}: {
  cacheKey: string
  profile: S3Profile
  bucket: string
  prefix: string
}) {
  try {
    const parsedKey: unknown = JSON.parse(cacheKey)

    if (!parsedKey || typeof parsedKey !== "object" || Array.isArray(parsedKey)) {
      return false
    }

    const keyParts = parsedKey as Record<string, unknown>

    return (
      keyParts.profileId === profile.id &&
      keyParts.endpoint === trimTrailingSlash(profile.endpoint) &&
      keyParts.region === profile.region &&
      keyParts.accessKeyId === profile.accessKeyId &&
      keyParts.forcePathStyle === profile.forcePathStyle &&
      keyParts.bucket === bucket &&
      keyParts.prefix === prefix
    )
  } catch {
    return false
  }
}

function serializeObjectListing(listing: ObjectListing): CachedObjectListing {
  return {
    entries: listing.entries.map((entry) => {
      if (entry.type === "folder") {
        return entry
      }

      return {
        ...entry,
        lastModified: entry.lastModified?.toISOString() ?? null,
      }
    }),
    nextContinuationToken: listing.nextContinuationToken,
  }
}

function deserializeObjectListing({
  record,
  source,
}: {
  record: ObjectListingCacheRecord
  source: ObjectListingCacheInfo["source"]
}): ObjectListing {
  return {
    entries: record.listing.entries.map((entry) => {
      if (entry.type === "folder") {
        return entry
      }

      return {
        ...entry,
        lastModified: entry.lastModified ? new Date(entry.lastModified) : null,
      }
    }),
    nextContinuationToken: record.listing.nextContinuationToken,
    cacheInfo: {
      cachedAt: record.cachedAt,
      expiresAt: record.expiresAt,
      source,
    },
  }
}

function getCachedObjectListing(cacheKey: string) {
  const store = getObjectListingCacheStore()
  const record = store[cacheKey]

  if (!record) {
    return null
  }

  if (
    typeof record.cachedAt !== "number" ||
    typeof record.expiresAt !== "number" ||
    !record.listing
  ) {
    delete store[cacheKey]
    saveObjectListingCacheStore(store)
    return null
  }

  if (record.expiresAt <= Date.now()) {
    delete store[cacheKey]
    saveObjectListingCacheStore(store)
    return null
  }

  try {
    return deserializeObjectListing({ record, source: "cache" })
  } catch {
    delete store[cacheKey]
    saveObjectListingCacheStore(store)
    return null
  }
}

function setCachedObjectListing(cacheKey: string, listing: ObjectListing) {
  const store = getObjectListingCacheStore()
  const now = Date.now()

  for (const [key, record] of Object.entries(store)) {
    if (record.expiresAt <= now) {
      delete store[key]
    }
  }

  store[cacheKey] = {
    cachedAt: now,
    expiresAt: now + OBJECT_LISTING_CACHE_TTL_MS,
    listing: serializeObjectListing(listing),
  }

  saveObjectListingCacheStore(store)
}

function deleteObjectListingCacheForPrefix({
  profile,
  bucket,
  prefix,
}: {
  profile: S3Profile
  bucket: string
  prefix: string
}) {
  const store = getObjectListingCacheStore()
  let changed = false

  for (const cacheKey of Object.keys(store)) {
    if (isMatchingObjectListingCacheKey({ cacheKey, profile, bucket, prefix })) {
      delete store[cacheKey]
      changed = true
    }
  }

  if (changed) {
    saveObjectListingCacheStore(store)
  }
}

export async function listBuckets(profile: S3Profile): Promise<BucketSummary[]> {
  const client = createClient(profile)
  const response = await client.send(new ListBucketsCommand({}))

  return (response.Buckets ?? [])
    .flatMap((bucket) => {
      if (!bucket.Name) {
        return []
      }

      return [
        {
          name: bucket.Name,
          createdAt: bucket.CreationDate ?? null,
        },
      ]
    })
    .sort((leftBucket, rightBucket) =>
      leftBucket.name.localeCompare(rightBucket.name, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    )
}

export async function listObjects({
  profile,
  bucket,
  prefix,
  continuationToken,
  cacheMode = "allow",
}: {
  profile: S3Profile
  bucket: string
  prefix: string
  continuationToken?: string | null
  cacheMode?: "allow" | "reload"
}): Promise<ObjectListing> {
  const client = createClient(profile)
  const normalizedPrefix = prefix.trim()
  const cacheKey = createObjectListingCacheKey({
    profile,
    bucket,
    prefix: normalizedPrefix,
    continuationToken,
  })

  if (cacheMode === "allow") {
    const cachedListing = getCachedObjectListing(cacheKey)

    if (cachedListing) {
      return cachedListing
    }
  } else {
    deleteObjectListingCacheForPrefix({
      profile,
      bucket,
      prefix: normalizedPrefix,
    })
  }

  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: normalizedPrefix || undefined,
      Delimiter: "/",
      ContinuationToken: continuationToken || undefined,
    })
  )

  const folders: FolderEntry[] = (response.CommonPrefixes ?? []).flatMap(
    (commonPrefix) => {
      if (!commonPrefix.Prefix) {
        return []
      }

      return [
        {
          type: "folder",
          key: commonPrefix.Prefix,
          name: getEntryName(commonPrefix.Prefix, normalizedPrefix),
        },
      ]
    }
  )

  const objects: ObjectEntry[] = (response.Contents ?? []).flatMap((object) => {
    if (!object.Key || object.Key === normalizedPrefix) {
      return []
    }

    return [
      {
        type: "object",
        key: object.Key,
        name: getEntryName(object.Key, normalizedPrefix),
        size: object.Size ?? 0,
        lastModified: object.LastModified ?? null,
        storageClass: object.StorageClass ?? "",
      },
    ]
  })

  const now = Date.now()
  const listing = {
    entries: sortEntries([...folders, ...objects]),
    nextContinuationToken: response.NextContinuationToken ?? null,
    cacheInfo: {
      cachedAt: now,
      expiresAt: now + OBJECT_LISTING_CACHE_TTL_MS,
      source: "network" as const,
    },
  }

  setCachedObjectListing(cacheKey, listing)

  return listing
}

export async function uploadObject({
  profile,
  bucket,
  key,
  file,
  onProgress,
}: {
  profile: S3Profile
  bucket: string
  key: string
  file: File
  onProgress?: (progress: UploadProgress) => void
}) {
  const client = createClient(profile)
  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: file,
      ContentType: file.type || undefined,
    },
    queueSize: 3,
    partSize: 8 * 1024 * 1024,
    leavePartsOnError: false,
  })

  upload.on("httpUploadProgress", (progress) => {
    onProgress?.({
      loaded: progress.loaded ?? 0,
      total: progress.total ?? null,
    })
  })

  await upload.done()
}

export async function createPresignedObjectUrl({
  profile,
  bucket,
  key,
  expiresInSeconds = 3600,
}: {
  profile: S3Profile
  bucket: string
  key: string
  expiresInSeconds?: number
}) {
  const client = createClient(profile)

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    {
      expiresIn: expiresInSeconds,
    }
  )
}

export function formatS3Error(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "S3 request failed"
}
