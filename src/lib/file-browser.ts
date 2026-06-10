import type { S3Profile, S3ProfileDraft } from "@/lib/profile-storage"
import type { Breadcrumb } from "@/lib/app-types"

export function profileToDraft(profile: S3Profile): S3ProfileDraft {
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

export function formatBytes(value: number) {
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

export function formatDate(value: Date | null) {
  if (!value) {
    return "--"
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value)
}

export function buildBreadcrumbs(prefix: string): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [{ label: "Root", prefix: "" }]
  let nextPrefix = ""

  for (const segment of prefix.split("/").filter(Boolean)) {
    nextPrefix += `${segment}/`
    crumbs.push({ label: segment, prefix: nextPrefix })
  }

  return crumbs
}

export function normalizeUploadKey(prefix: string, fileName: string) {
  return `${prefix}${fileName}`.replace(/^\/+/, "")
}
