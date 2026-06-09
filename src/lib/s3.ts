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
}

export type UploadProgress = {
  loaded: number
  total: number | null
}

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
}: {
  profile: S3Profile
  bucket: string
  prefix: string
  continuationToken?: string | null
}): Promise<ObjectListing> {
  const client = createClient(profile)
  const normalizedPrefix = prefix.trim()
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

  return {
    entries: sortEntries([...folders, ...objects]),
    nextContinuationToken: response.NextContinuationToken ?? null,
  }
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

