export interface ShoutboxMessage {
  id: string
  senderInboxId: string
  senderAddress: string
  content: string
  timestamp: number
  groupId: string
}

export type MessageStatus = 'sending' | 'sent' | 'failed'
