// Core types for the XRPL Xumm Swap app

export interface Token {
  symbol: string
  currency: string // 'XRP' or hex/iso
  issuer?: string
  name?: string
  logo?: string // public logo URL when available
  md5?: string // xrpl.to token id / image hash
  ext?: string // logo extension from xrpl.to (png/webp/jpg)
}

export interface Balance {
  [key: string]: string // symbol or 'XRP' -> balance
}

export interface XummPayloadResponse {
  uuid: string
  refs?: {
    qr_png?: string
    qr_matrix?: string
    qr_uri_quality_opts?: string[]
  }
  next?: {
    always?: string
  }
  expired?: boolean
}

export interface XummPayloadStatus {
  meta: {
    signed?: boolean
    cancelled?: boolean
    expired?: boolean
    resolved?: boolean
  }
  response?: {
    account?: string
    txid?: string
    hex?: string
  }
  error?: boolean
}
