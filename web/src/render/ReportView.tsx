import type { CSSProperties } from 'react'
import type { Block, Cell, Column, ReportDoc, Row, Tone } from '../report/model.ts'

/**
 * The reading view — the same document as the PDF, reflowing: it scales
 * with the reader's text size and is structured so a screen reader
 * announces sections, tables and figures in a sensible order (REACH-04).
 * Bars are decoration; every number is also text (REACH-03).
 */

const pad = (n: number) => String(n).padStart(2, '0')
const cellText = (c: Cell | undefined) => (c == null ? '' : typeof c === 'string' ? c : c.text)
const cellSub = (c: Cell | undefined) => (c != null && typeof c !== 'string' ? c.sub : undefined)
const cellTone = (c: Cell | undefined): Tone | undefined => (c != null && typeof c !== 'string' ? c.tone : undefined)
const toneClass = (t?: Tone) => (t && t !== 'default' ? `tone-${t}` : '')

export function ReportView({ doc, scale = 1 }: { doc: ReportDoc; scale?: number }) {
  return (
    <article className="doc" aria-labelledby="doc-title" style={{ '--s': scale } as CSSProperties} lang="en">
      <header>
        <p className="doc-kicker">Carma · {doc.title}</p>
        <h1 className="doc-title" id="doc-title">
          {doc.subject}
        </h1>
        {doc.subjectDetail ? <p className="doc-subtitle">{doc.subjectDetail}</p> : null}
        <p className="doc-period">
          {doc.periodLabel} <span>· {doc.periodRange}</span>
        </p>
        <hr className="doc-rule" />

        {doc.note ? (
          <aside className="doc-note" aria-label={`A note from ${doc.note.from}`}>
            <p className="doc-note-label">A note from {doc.note.from}</p>
            <p>{doc.note.text}</p>
          </aside>
        ) : null}

        <h2 className="doc-label">What this report covers</h2>
        <dl className="doc-scope">
          {doc.scope.map((line) => (
            <div key={line.label} style={{ display: 'contents' }}>
              <dt>{line.label}</dt>
              <dd>{line.value}</dd>
            </div>
          ))}
        </dl>

        {doc.omitted.length > 0 ? (
          <div className="doc-omitted">
            <h2 className="doc-label">Not in this report</h2>
            <ul>
              {doc.omitted.map((o) => (
                <li key={o.title}>
                  <strong>{o.title}.</strong> {o.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {doc.showContents ? (
          <nav className="doc-contents" aria-label="Contents">
            <h2 className="doc-label">Contents</h2>
            <ol>
              {doc.sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#sec-${s.id}`}>
                    <span>{pad(i + 1)}</span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
      </header>

      {doc.sections.map((s, i) => (
        <section key={s.id} id={`sec-${s.id}`} className="doc-section" aria-labelledby={`h-${s.id}`}>
          <h2 className="doc-section-title" id={`h-${s.id}`}>
            <span>{pad(i + 1)}</span>
            {s.title}
          </h2>
          {s.blocks.map((b, j) => (
            <BlockView key={j} block={b} />
          ))}
        </section>
      ))}

      <footer className="doc-footer">
        {doc.notes.map((n) => (
          <p key={n}>{n}</p>
        ))}
        <p>
          Generated {doc.generated.atLabel} by {doc.generated.by}, from Carma records as of {doc.generated.dataAsOfLabel}.
        </p>
        {doc.contact ? (
          <p>
            Questions about this report: {doc.contact.name}
            {doc.contact.detail ? ` · ${doc.contact.detail}` : ''}.
          </p>
        ) : null}
      </footer>
    </article>
  )
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'figure':
      return (
        <div className="b-figure">
          <p className="b-figure-label">{block.label}</p>
          <p className="b-figure-value">{block.value}</p>
          {block.caption ? <p className="b-figure-caption">{block.caption}</p> : null}
        </div>
      )
    case 'stats':
      return (
        <dl className="b-stats">
          {block.items.map((item) => (
            <div key={item.label} className={toneClass(item.tone)}>
              <dt>{item.label}</dt>
              <dd>
                {item.value}
                {item.caption ? <small>{item.caption}</small> : null}
              </dd>
            </div>
          ))}
        </dl>
      )
    case 'bars':
      return (
        <figure style={{ margin: 0 }}>
          <ul className="b-bars">
            {block.rows.map((row) => (
              <li key={row.label} className={`b-bar ${toneClass(row.tone)}`}>
                <span className="b-bar-label">
                  <strong>{row.label}</strong>
                  {row.sub ? <small>{row.sub}</small> : null}
                </span>
                <span className="b-bar-track" aria-hidden="true">
                  <span className="b-bar-fill" style={{ width: `${Math.max(0, Math.min(1, row.fraction)) * 100}%`, display: 'block' }} />
                </span>
                <span className="b-bar-value">
                  {row.value}
                  {row.share ? <span> {row.share}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          {block.caption ? <figcaption className="b-note tone-muted" style={{ marginTop: 8 }}>{block.caption}</figcaption> : null}
        </figure>
      )
    case 'stack':
      return (
        <figure style={{ margin: 0 }}>
          <div className="b-stack-bar" aria-hidden="true">
            {block.segments.map((s) => (
              <span key={s.label} className={`b-stack-seg fill-${s.fill}`} style={{ width: `${Math.max(0, s.fraction) * 100}%` }} />
            ))}
          </div>
          <ul className="b-stack-legend">
            {block.segments.map((s) => (
              <li key={s.label}>
                <i className={`fill-${s.fill}`} aria-hidden="true" />
                {s.label} <b>{s.value}</b>
              </li>
            ))}
          </ul>
          {block.caption ? <figcaption className="b-note tone-muted">{block.caption}</figcaption> : null}
        </figure>
      )
    case 'table':
      return <TableView columns={block.columns} rows={block.rows} footer={block.footer} caption={block.caption} />
    case 'facts':
      return (
        <dl className="b-facts">
          {block.items.map((f) => (
            <div key={f.label} style={{ display: 'contents' }}>
              <dt>{f.label}</dt>
              <dd className={toneClass(f.tone)}>{f.value}</dd>
            </div>
          ))}
        </dl>
      )
    case 'note':
      return <p className={`b-note ${toneClass(block.tone)}`}>{block.text}</p>
    case 'list':
      return (
        <ul className="b-list">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )
  }
}

function TableView({ columns, rows, footer, caption }: { columns: Column[]; rows: Row[]; footer?: Row; caption?: string }) {
  const isNum = (c: Column) => c.align === 'right'
  const renderCells = (row: Row) =>
    columns.map((col) => {
      const cell = row.cells[col.key]
      const text = cellText(cell)
      const sub = cellSub(cell)
      return (
        <td key={col.key} data-label={col.label} data-empty={text === '' && !sub ? 'true' : undefined} className={[isNum(col) ? 'num' : '', toneClass(cellTone(cell))].join(' ').trim() || undefined}>
          {text}
          {sub ? <small>{sub}</small> : null}
        </td>
      )
    })
  return (
    <div className="b-table-wrap">
      <table className="b-table stackable">
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={isNum(c) ? 'num' : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.flatMap((row, i) => {
            const marks = row.marks ?? []
            const cls = [toneClass(row.tone), marks.length > 0 ? 'has-marks' : ''].join(' ').trim() || undefined
            const out = [
              <tr key={`r${i}`} className={cls}>
                {renderCells(row)}
              </tr>,
            ]
            if (marks.length > 0) {
              out.push(
                <tr key={`m${i}`} className="marks">
                  <td colSpan={columns.length}>{marks.join(' · ')}</td>
                </tr>,
              )
            }
            return out
          })}
        </tbody>
        {footer ? (
          <tfoot>
            <tr>{renderCells(footer)}</tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  )
}
