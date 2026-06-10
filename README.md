# S3 Browser

A mobile-first, browser-only S3-compatible file browser inspired by Cyberduck.

## Runtime Model

- All S3 requests run directly in the browser.
- Credentials are saved in plaintext `localStorage`.
- There is no backend, S3 proxy, Pages Function, or server-side signing.
- Object open actions create presigned `GetObject` URLs that expire after 1 hour.
- Uploads use client-signed single `PUT` URLs with browser-native progress events.

## Local Development

```bash
bun install
bun run dev
```

## Cloudflare Pages

Use Cloudflare Pages as the primary static deployment target:

- Build command: `bun run build`
- Build output directory: `dist`

## Cloudflare Workers Static Assets

The included `wrangler.toml` serves the built Vite app as static assets with SPA fallback:

```toml
name = "s3browser"
compatibility_date = "2026-06-09"

[assets]
directory = "./dist/"
not_found_handling = "single-page-application"
```

Build before deploying:

```bash
bun run build
wrangler deploy
```

## S3 CORS

Because requests are made from the browser, every S3-compatible endpoint must allow the deployed origin. A typical bucket CORS policy needs browser access for listing, uploading, and opening objects:

```json
[
  {
    "AllowedOrigins": ["https://your-app.pages.dev"],
    "AllowedMethods": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "x-amz-request-id"],
    "MaxAgeSeconds": 3000
  }
]
```

Limit `AllowedOrigins` to the exact Cloudflare Pages or Workers domain you deploy.

Uploads intentionally avoid browser multipart upload. That means the app does not depend on multipart `UploadPart` responses exposing `ETag`, and the progress bar is driven by the browser `XMLHttpRequest.upload` progress event. Single `PUT` uploads are limited to 5 GB.
