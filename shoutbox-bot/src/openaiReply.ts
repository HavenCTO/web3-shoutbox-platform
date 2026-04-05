import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import {
  inboxPrefix,
  mergeTriggerIntoTranscript,
  type ShoutboxReplyContext,
} from './shoutboxContext.js'

export interface PeerReplyGeneratorSettings {
  model: string
  systemPrompt: string
}

const SHOUTBOX_WINDOW_HINT =
  'This is a short-lived public shoutbox group (roughly five minutes). Reply to the latest peer message in context with other participants.'

export function buildChatCompletionMessages(
  ctx: ShoutboxReplyContext,
  systemPrompt: string,
): ChatCompletionMessageParam[] {
  const participantLine = (() => {
    const labels = [...ctx.memberInboxIds].map((id) => inboxPrefix(id))
    const uniq = [...new Set(labels)]
    uniq.sort()
    return uniq.length > 0
      ? `${SHOUTBOX_WINDOW_HINT}\n\nParticipants (opaque inbox id prefixes): ${uniq.join(', ')}.`
      : SHOUTBOX_WINDOW_HINT
  })()

  const system: ChatCompletionMessageParam = {
    role: 'system',
    content: `${systemPrompt}\n\n${participantLine}`,
  }

  const withTrigger = mergeTriggerIntoTranscript(ctx.textMessages, {
    id: ctx.trigger.id,
    senderInboxId: ctx.trigger.senderInboxId,
    content: ctx.trigger.content,
    sentAtMs: ctx.trigger.sentAtMs,
  })
  const chronological = [...withTrigger].sort((x, y) => x.sentAtMs - y.sentAtMs)

  const transcript: ChatCompletionMessageParam[] = chronological.map((row) => {
    if (row.senderInboxId === ctx.botInboxId) {
      return { role: 'assistant', content: row.content }
    }
    return {
      role: 'user',
      content: `[${inboxPrefix(row.senderInboxId)}]: ${row.content}`,
    }
  })

  return [system, ...transcript]
}

/**
 * Async formatter that calls the OpenAI-compatible Chat Completions API using full
 * group context (members + recent plain-text transcript + the bot’s prior assistant turns).
 */
export function createContextualPeerReplyGenerator(
  client: OpenAI,
  settings: PeerReplyGeneratorSettings,
): (ctx: ShoutboxReplyContext) => Promise<string> {
  const { model, systemPrompt } = settings
  return async (ctx: ShoutboxReplyContext): Promise<string> => {
    const messages = buildChatCompletionMessages(ctx, systemPrompt)
    const res = await client.chat.completions.create({
      model,
      messages,
    })
    const content = res.choices[0]?.message?.content
    if (typeof content !== 'string') {
      throw new Error('LLM returned no text content')
    }
    const out = content.trim()
    if (out === '') {
      throw new Error('LLM returned empty text')
    }
    return out
  }
}
