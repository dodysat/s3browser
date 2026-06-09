export type S3Profile = {
  id: string
  name: string
  endpoint: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
  bucket: string
  forcePathStyle: boolean
}

export type S3ProfileDraft = Omit<S3Profile, "id">

const PROFILES_STORAGE_KEY = "s3browser:profiles:v1"
const ACTIVE_PROFILE_STORAGE_KEY = "s3browser:active-profile-id:v1"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readString(value: unknown) {
  return typeof value === "string" ? value : ""
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}

function createProfileId() {
  if ("randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `profile-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function normalizeProfile(value: unknown): S3Profile | null {
  if (!isRecord(value)) {
    return null
  }

  const endpoint = readString(value.endpoint).trim()
  const accessKeyId = readString(value.accessKeyId).trim()
  const secretAccessKey = readString(value.secretAccessKey)

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null
  }

  const id = readString(value.id).trim() || createProfileId()
  const name = readString(value.name).trim() || endpoint
  const region = readString(value.region).trim() || "us-east-1"

  return {
    id,
    name,
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    sessionToken: readString(value.sessionToken).trim(),
    bucket: readString(value.bucket).trim(),
    forcePathStyle: readBoolean(value.forcePathStyle, true),
  }
}

export function createEmptyProfileDraft(): S3ProfileDraft {
  return {
    name: "",
    endpoint: "",
    region: "us-east-1",
    accessKeyId: "",
    secretAccessKey: "",
    sessionToken: "",
    bucket: "",
    forcePathStyle: true,
  }
}

export function createProfile(draft: S3ProfileDraft): S3Profile {
  return {
    id: createProfileId(),
    name: draft.name.trim() || draft.endpoint.trim(),
    endpoint: draft.endpoint.trim(),
    region: draft.region.trim() || "us-east-1",
    accessKeyId: draft.accessKeyId.trim(),
    secretAccessKey: draft.secretAccessKey,
    sessionToken: draft.sessionToken.trim(),
    bucket: draft.bucket.trim(),
    forcePathStyle: draft.forcePathStyle,
  }
}

export function loadProfiles(): S3Profile[] {
  const storedValue = localStorage.getItem(PROFILES_STORAGE_KEY)

  if (!storedValue) {
    return []
  }

  try {
    const parsedValue: unknown = JSON.parse(storedValue)

    if (!Array.isArray(parsedValue)) {
      localStorage.removeItem(PROFILES_STORAGE_KEY)
      return []
    }

    return parsedValue.flatMap((profile) => {
      const normalizedProfile = normalizeProfile(profile)
      return normalizedProfile ? [normalizedProfile] : []
    })
  } catch {
    localStorage.removeItem(PROFILES_STORAGE_KEY)
    return []
  }
}

export function saveProfiles(profiles: S3Profile[]) {
  localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles))
}

export function loadActiveProfileId() {
  return localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY)
}

export function saveActiveProfileId(profileId: string | null) {
  if (!profileId) {
    localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY)
    return
  }

  localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profileId)
}

