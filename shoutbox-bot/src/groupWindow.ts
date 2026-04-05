import { z } from 'zod'

const groupWindowSchema = z.object({
  groupId: z.string().min(1),
  epoch: z.number(),
  createdBy: z.string(),
  createdAt: z.number(),
  expiresAt: z.number(),
  windowMinutes: z.number(),
})

export type GroupWindow = z.infer<typeof groupWindowSchema>

/** Parse GunDB `shoutbox-v1/groups/{roomKey}` payload. */
export function parseGroupWindowFromGun(data: unknown): GroupWindow | null {
  const r = groupWindowSchema.safeParse(data)
  return r.success ? r.data : null
}

/** Whether the sliding window for this group is still active. */
export function isActiveGroupWindow(gw: GroupWindow, nowMs: number): boolean {
  return nowMs <= gw.expiresAt
}
