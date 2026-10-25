import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { XmtpStatus } from '@/hooks/useXmtpClient'

interface XmtpStepIndicatorProps {
  status: XmtpStatus
  compact?: boolean
}

type StepState = 'done' | 'active' | 'pending'

interface Step {
  label: string
  state: StepState
}

function getSteps(status: XmtpStatus): Step[] {
  if (status === 'ready') {
    return [
      { label: 'Wallet connected', state: 'done' },
      { label: 'Signed message', state: 'done' },
      { label: 'Inbox ready', state: 'done' },
    ]
  }
  // initializing — show progress
  return [
    { label: 'Wallet connected', state: 'done' },
    { label: 'Signing message', state: 'active' },
    { label: 'Creating inbox', state: 'pending' },
  ]
}

export function XmtpStepIndicator({ status, compact }: XmtpStepIndicatorProps) {
  if (status === 'idle' || status === 'error') return null

  const steps = getSteps(status)

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-evm">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Initializing messaging…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2" role="status" aria-label="Initializing encrypted messaging">
      <p className="text-sm font-medium text-ink">Initializing encrypted messaging…</p>
      <div className="flex items-center gap-1">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-1">
            <StepIcon state={step.state} />
            <span className={cn(
              'text-xs',
              step.state === 'done' && 'text-arkiv',
              step.state === 'active' && 'text-evm',
              step.state === 'pending' && 'text-ink-faint',
            )}>
              {step.label}
            </span>
            {i < steps.length - 1 && (
              <span className="mx-1 text-ink-faint">→</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StepIcon({ state }: { state: StepState }) {
  if (state === 'done') return <Check className="h-3.5 w-3.5 text-arkiv" />
  if (state === 'active') return <Loader2 className="h-3.5 w-3.5 animate-spin text-evm" />
  return <span className="inline-block h-3.5 w-3.5 rounded-full border border-void-highest" />
}
