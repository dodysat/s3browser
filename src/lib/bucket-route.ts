export type BucketRoute = {
  bucket: string
  prefix: string
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
