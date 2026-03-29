export interface ShoutboxPostMessage {
  source: 'web3-shoutbox'
  type: ShoutboxEventType | ShoutboxCommandType
  payload: unknown
}

export type ShoutboxEventType =
  | 'ready'
  | 'wallet-connected'
  | 'wallet-disconnected'
  | 'message-sent'
  | 'message-received'
  | 'presence-updated'
  | 'error'
  | 'resize'
  | 'status-response'

export type ShoutboxCommandType =
  | 'set-room'
  | 'set-theme'
  | 'get-status'
