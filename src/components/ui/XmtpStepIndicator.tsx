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
      <div className="flex items-center gap-2 text-xs text-yellow-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Initializing messaging…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2" role="status" aria-label="Initializing encrypted messaging">
      <p className="text-sm font-medium text-gray-200">Initializing encrypted messaging…</p>
      <div className="flex items-center gap-1">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-1">
            <StepIcon state={step.state} />
            <span className={cn(
              'text-xs',
              step.state === 'done' && 'text-green-400',
              step.state === 'active' && 'text-yellow-400',
              step.state === 'pending' && 'text-gray-500',
            )}>
              {step.label}
            </span>
            {i < steps.length - 1 && (
              <span className="mx-1 text-gray-600">→</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StepIcon({ state }: { state: StepState }) {
  if (state === 'done') return <Check className="h-3.5 w-3.5 text-green-400" />
  if (state === 'active') return <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-400" />
  return <span className="inline-block h-3.5 w-3.5 rounded-full border border-gray-600" />
}
