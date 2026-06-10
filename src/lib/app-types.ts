export type Notice = {
  type: "success" | "error" | "info"
  text: string
}

export type UploadState = {
  fileName: string
  loaded: number
  total: number | null
  startedAt: number
  updatedAt: number
  index: number
  totalFiles: number
}

export type Breadcrumb = {
  label: string
  prefix: string
}
