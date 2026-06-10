export type BucketRoute = {
  bucket: string
  prefix: string
}

export type ShareRoute = {
  bucket: string
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  region: string
  sessionToken: string
  prefix: string
  name: string
  forcePathStyle: boolean
}

export function normalizeRoutePrefix(prefix: string) {
  const normalizedPrefix = prefix
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/")

  return normalizedPrefix ? `${normalizedPrefix}/` : ""
}

function safelyDecodeRouteSegment(segment: string) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export function createRouteKey(route: BucketRoute) {
  return `${route.bucket}\n${route.prefix}`
}

export function createBucketRoutePath(bucket: string, prefix: string) {
  const encodedBucket = encodeURIComponent(bucket)
  const encodedPrefix = normalizeRoutePrefix(prefix)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/")

  return `/b/${encodedBucket}${encodedPrefix ? `/${encodedPrefix}` : ""}`
}

export function parseBucketRoute(pathname = window.location.pathname) {
  const segments = pathname.split("/").filter(Boolean)

  if (segments[0] !== "b" || !segments[1]) {
    return null
  }

  return {
    bucket: safelyDecodeRouteSegment(segments[1]),
    prefix: normalizeRoutePrefix(
      segments.slice(2).map(safelyDecodeRouteSegment).join("/")
    ),
  } satisfies BucketRoute
}

function readSearchParam(params: URLSearchParams, names: string[]) {
  for (const name of names) {
    const value = params.get(name)?.trim()

    if (value) {
      return value
    }
  }

  return ""
}

function readBooleanSearchParam(
  params: URLSearchParams,
  names: string[],
  fallback: boolean
) {
  const value = readSearchParam(params, names).toLowerCase()

  if (!value) {
    return fallback
  }

  return ["1", "true", "yes", "on"].includes(value)
}

export function parseShareRoute(
  pathname = window.location.pathname,
  search = window.location.search
): ShareRoute | null {
  const segments = pathname.split("/").filter(Boolean)

  if (segments[0] !== "share") {
    return null
  }

  const params = new URLSearchParams(search)
  const bucket = readSearchParam(params, ["bucket"])
  const endpoint = readSearchParam(params, ["endpoint"])
  const accessKeyId = readSearchParam(params, ["access", "accessKeyId"])
  const secretAccessKey = readSearchParam(params, ["secret", "secretAccessKey"])

  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    return null
  }

  return {
    bucket,
    endpoint,
    accessKeyId,
    secretAccessKey,
    region: readSearchParam(params, ["region"]) || "us-east-1",
    sessionToken: readSearchParam(params, ["session", "sessionToken", "token"]),
    prefix: normalizeRoutePrefix(readSearchParam(params, ["prefix", "path"])),
    name: readSearchParam(params, ["name"]) || `Shared ${bucket}`,
    forcePathStyle: readBooleanSearchParam(
      params,
      ["pathStyle", "forcePathStyle"],
      true
    ),
  }
}

export function writeBucketRoute(
  bucket: string,
  prefix: string,
  mode: "push" | "replace"
) {
  const nextPath = createBucketRoutePath(bucket, prefix)

  if (window.location.pathname === nextPath) {
    return
  }

  window.history[mode === "push" ? "pushState" : "replaceState"](
    { bucket, prefix },
    "",
    nextPath
  )
}
