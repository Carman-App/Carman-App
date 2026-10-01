import type { ReactNode } from 'react'
import { ApiError, NetworkError } from '../api/client.ts'

export function ToggleChip({ on, onClick, children, sub, title }: { on: boolean; onClick: () => void; children: ReactNode; sub?: string; title?: string }) {
  return (
    <button type="button" className="chip" aria-pressed={on} onClick={onClick} title={title}>
      {children}
      {sub ? <span className="chip-sub">{sub}</span> : null}
    </button>
  )
}

export function Loading({ label = 'Loading records…' }: { label?: string }) {
  return (
    <div className="empty" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      {label}
    </div>
  )
}

function errorText(error: unknown): string {
  if (error instanceof NetworkError) return 'Carma’s server can’t be reached, and there is no saved copy of these records on this device yet.'
  if (error instanceof ApiError && error.status === 403) return 'You don’t have access to these records.'
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="empty" role="alert">
      <p style={{ margin: '0 0 12px' }}>{errorText(error)}</p>
      {onRetry ? (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  )
}

export function OfflineNote({ savedAt }: { savedAt: string }) {
  const when = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(savedAt))
  return (
    <div className="banner warning" role="status">
      <p>
        <strong>Offline.</strong> Using the records saved on this device at {when}. The report states when its records are from.
      </p>
    </div>
  )
}
