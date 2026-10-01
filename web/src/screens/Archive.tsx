import { useState } from 'react'
import { Link } from 'react-router'
import { Loading } from '../components/ui.tsx'
import { downloadBlob, formatSize, useArchive, useArchiveActions } from '../render/export.ts'

/**
 * Every file this browser has produced, kept byte-for-byte (SYS-06):
 * "download again" returns exactly what was sent, even after the records
 * have moved on; "rebuild" makes a fresh one from today's records.
 */
export function Archive() {
  const archive = useArchive()
  const { remove } = useArchiveActions()
  const [confirming, setConfirming] = useState<string | null>(null)
  const stamp = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <>
      <div className="page-head">
        <p className="eyebrow">Archive</p>
        <h1 className="page-title">Reports you’ve produced</h1>
        <p className="page-lede">Each file is kept exactly as it was sent, so you can send the same document twice. Kept in this browser only.</p>
      </div>
      {archive.isLoading ? <Loading label="Opening the archive…" /> : null}
      {archive.data && archive.data.length === 0 ? (
        <div className="empty">
          <p>Nothing yet. Reports you download or share are kept here.</p>
          <Link className="btn btn-primary" to="/expense">
            Build an expense report
          </Link>
        </div>
      ) : null}
      <ul className="archive-list">
        {archive.data?.map((e) => (
          <li key={e.id} className="archive-item">
            <div>
              <h3>
                <span className="badge">{e.format}</span>
                {e.title} · {e.subject}
              </h3>
              <p>
                {e.periodLabel} · {e.periodRange}
              </p>
              <p>
                Generated {stamp.format(new Date(e.generatedAt))} · {e.headline} · {e.recordCount} record{e.recordCount === 1 ? '' : 's'} · {formatSize(e.size)}
                {e.pages ? ` · ${e.pages} page${e.pages === 1 ? '' : 's'}` : ''}
              </p>
            </div>
            <div className="archive-actions">
              <button type="button" className="btn btn-secondary" onClick={() => downloadBlob(e.blob, e.filename)}>
                Download again
              </button>
              <Link className="btn btn-ghost" to={e.route}>
                Rebuild with today’s records
              </Link>
              {confirming === e.id ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    void remove(e.id)
                    setConfirming(null)
                  }}
                >
                  Confirm delete
                </button>
              ) : (
                <button type="button" className="btn btn-ghost" onClick={() => setConfirming(e.id)} aria-label={`Delete ${e.filename}`}>
                  Delete
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
