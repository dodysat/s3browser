export type Notice = {
  type: "success" | "error" | "info"
  text: string
}

export type UploadTaskStatus = "queued" | "uploading" | "success" | "error"

export type UploadTask = {
  id: string
  fileName: string
  key: string
  loaded: number
  total: number | null
  startedAt: number
  updatedAt: number
  completedAt: number | null
  status: UploadTaskStatus
  error: string | null
}

export type WakeLockState = {
  status: "idle" | "active" | "unavailable" | "released"
  text: string
}

export type Breadcrumb = {
  label: string
  prefix: string
}
