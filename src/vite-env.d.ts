/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID: string
  readonly VITE_XMTP_ENV: string
  readonly VITE_APP_URL: string
  readonly VITE_GUN_RELAY_PEERS: string
  readonly VITE_SLIDING_WINDOW_MINUTES: string
  /** Set to `"true"` to emit `[xmtp-mls-diagnostics-v1]` JSON in production builds. */
  readonly VITE_XMTP_MLS_DIAGNOSTICS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
