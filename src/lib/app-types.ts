export type Notice = {
  type: "success" | "error" | "info"
  text: string
}

export type UploadState = {
  fileName: string
  loaded: number
  total: number | null
  index: number
  totalFiles: number
}

export type Breadcrumb = {
  label: string
  prefix: string
}
