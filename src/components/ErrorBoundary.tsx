import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  context?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const ctx = this.props.context ?? 'unknown'
    console.error(
      `[ErrorBoundary:${ctx}] Caught error:`,
      error.message,
      '\nComponent stack:',
      info.componentStack,
    )
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div
          className="flex min-h-screen items-center justify-center bg-gray-950 p-4 text-white dark:bg-gray-950"
          role="alert"
        >
          <div className="mx-4 max-w-md text-center">
            <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-yellow-500" />
            <h1 className="text-xl font-bold sm:text-2xl">Something went wrong</h1>
            <p className="mt-2 text-sm text-gray-400">
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
            <button
              onClick={this.handleReset}
              className="focus-ring mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
