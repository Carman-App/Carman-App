import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { renderSummaryCard } from '../render/card.ts'
import { canShareFiles, downloadBlob, formatSize, shareFiles, useArchiveActions, type ArchiveEntry, type ArchiveFormat } from '../render/export.ts'
import type { ReportDoc } from '../report/model.ts'

/**
 * "See it before it leaves" (SYS-10): the PDF is rendered first and shown
 * page by page; every way out of the app — download, share, CSV, summary
 * card — starts from here, and each file is archived exactly as produced.
 */

type Props = {
  doc: ReportDoc
  generatedAt: string
  route: string
  csv: () => string
  onRecord?: (format: 'PDF' | 'CSV') => void
  onClose: () => void
}

type Pdf = { blob: Blob; pages: number; url: string }

// pdf.js is large; it loads with the first preview, not with the app.
const PdfPages = lazy(() => import('../render/PdfPages.tsx'))

// The demo build is a preview inside other pages, which can't hand over files.
const SAVING_OFF = import.meta.env.MODE === 'demo'

export function ExportPanel({ doc, generatedAt, route, csv, onRecord, onClose }: Props) {
  const [pdfFile, setPdfFile] = useState<Pdf | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null)
  const [status, setStatus] = useState('')
  const { save } = useArchiveActions()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    let url: string | null = null
    closeRef.current?.focus()
    import('../render/pdf.tsx')
      .then(({ renderPdf }) => renderPdf(doc, new Date(generatedAt)))
      .then(({ blob, pages }) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setPdfFile({ blob, pages, url })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : String(error)
        // The layout engine is WebAssembly, which some locked-down pages refuse.
        setFailed(
          /WebAssembly/i.test(message)
            ? 'The pages can’t be drawn here, because this page doesn’t allow the PDF engine to run. In the app, every page of the PDF appears here before you send it.'
            : `The PDF couldn’t be laid out: ${message}`,
        )
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [doc, generatedAt])

  useEffect(() => () => {
    if (card) URL.revokeObjectURL(card.url)
  }, [card])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const archive = (format: ArchiveFormat, blob: Blob, filename: string, pages?: number) =>
    save({
      kind: doc.kind,
      format,
      title: doc.title,
      subject: doc.subject,
      periodLabel: doc.periodLabel,
      periodRange: doc.periodRange,
      generatedAt,
      filename,
      size: blob.size,
      pages,
      identity: doc.identity,
      fingerprint: doc.fingerprint,
      route,
      recordCount: doc.recordCount,
      headline: `${doc.headline.label}: ${doc.headline.value}`,
      blob,
    } satisfies Omit<ArchiveEntry, 'id'>)

  const csvName = doc.filename.replace(/\.pdf$/i, '.csv')
  const cardName = doc.filename.replace(/\.pdf$/i, ' - summary.png')
  const pdfAsFile = pdfFile ? new File([pdfFile.blob], doc.filename, { type: 'application/pdf' }) : null
  const shareable = !SAVING_OFF && pdfAsFile ? canShareFiles([pdfAsFile]) : false

  const downloadPdf = async () => {
    if (!pdfFile) return
    downloadBlob(pdfFile.blob, doc.filename)
    await archive('pdf', pdfFile.blob, doc.filename, pdfFile.pages)
    onRecord?.('PDF')
    setStatus(`Saved ${doc.filename} and kept a copy in the archive.`)
  }

  const sharePdf = async (withCard: boolean) => {
    if (!pdfFile || !pdfAsFile) return
    const files = withCard && card ? [new File([card.blob], cardName, { type: 'image/png' }), pdfAsFile] : [pdfAsFile]
    const result = await shareFiles(files, doc.filename.replace(/\.pdf$/i, ''), `${doc.title}: ${doc.subject}, ${doc.periodRange}.`)
    if (result === 'shared') {
      await archive('pdf', pdfFile.blob, doc.filename, pdfFile.pages)
      if (withCard && card) await archive('png', card.blob, cardName)
      onRecord?.('PDF')
      setStatus('Shared, and a copy is kept in the archive.')
    } else if (result === 'failed') {
      setStatus('This browser couldn’t open the share sheet. Download the file and send it from your device instead.')
    }
  }

  const downloadCsv = async () => {
    const blob = new Blob([csv()], { type: 'text/csv;charset=utf-8' })
    downloadBlob(blob, csvName)
    await archive('csv', blob, csvName)
    onRecord?.('CSV')
    setStatus(`Saved ${csvName} — the same rows as the report, for a spreadsheet.`)
  }

  const makeCard = async () => {
    try {
      const blob = await renderSummaryCard(doc)
      setCard({ blob, url: URL.createObjectURL(blob) })
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The summary card could not be drawn.')
    }
  }

  const downloadCard = async () => {
    if (!card) return
    downloadBlob(card.blob, cardName)
    await archive('png', card.blob, cardName)
    setStatus(`Saved ${cardName}. Send the PDF with it — the card is a summary, not the report.`)
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <div className="modal-head">
          <h2 id="export-title">Check it, then send it</h2>
          <span className="spacer" />
          <button ref={closeRef} type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          {pdfFile ? (
            <Suspense
              fallback={
                <div className="pdf-wait" role="status">
                  <div>
                    <div className="spinner" aria-hidden="true" />
                    Drawing the pages…
                  </div>
                </div>
              }
            >
              <PdfPages blob={pdfFile.blob} title={doc.filename} />
            </Suspense>
          ) : (
            <div className="pdf-wait" role="status" aria-live="polite">
              {failed ? (
                <p>{failed}</p>
              ) : (
                <div>
                  <div className="spinner" aria-hidden="true" />
                  Laying out the pages…
                </div>
              )}
            </div>
          )}
          <div className="export-side">
            {SAVING_OFF ? (
              <p className="banner">
                This preview can’t save files. In the app, this is where you download or share the PDF, the CSV and the summary card.
              </p>
            ) : null}
            <div>
              <h3>The report</h3>
              <p className="file-facts">
                {doc.filename}
                <br />
                {pdfFile ? `${pdfFile.pages} page${pdfFile.pages === 1 ? '' : 's'} · ${formatSize(pdfFile.blob.size)}${pdfFile.blob.size > 1024 * 1024 ? ' — over 1 MB, may be slow on WhatsApp' : ' — small enough for WhatsApp'}` : 'Preparing…'}
              </p>
              {pdfFile && doc.pageLimit != null && pdfFile.pages > doc.pageLimit ? (
                <p className="file-facts tone-warning" role="alert">
                  This runs to {pdfFile.pages} pages, and expense systems often take only {doc.pageLimit}. Shorten the note on the first page to bring it back to one.
                </p>
              ) : null}
            </div>
            <button type="button" className="btn btn-primary" disabled={!pdfFile || SAVING_OFF} onClick={() => void downloadPdf()}>
              Download PDF
            </button>
            {shareable ? (
              <button type="button" className="btn btn-secondary" disabled={!pdfFile} onClick={() => void sharePdf(false)}>
                Share PDF…
              </button>
            ) : null}
            {pdfFile && !SAVING_OFF ? (
              <a className="btn btn-ghost" href={pdfFile.url} target="_blank" rel="noreferrer">
                Open in a new tab to print
              </a>
            ) : null}

            <h3>For a spreadsheet</h3>
            <button type="button" className="btn btn-secondary" disabled={SAVING_OFF} onClick={() => void downloadCsv()}>
              Download CSV
            </button>

            <h3>Summary card</h3>
            {card ? (
              <>
                <img className="card-preview" src={card.url} alt={`Summary card: ${doc.headline.label} ${doc.headline.value}, ${doc.periodLabel}`} />
                <button type="button" className="btn btn-secondary" disabled={SAVING_OFF} onClick={() => void downloadCard()}>
                  Download image
                </button>
                {shareable && pdfAsFile && canShareFiles([new File([card.blob], cardName, { type: 'image/png' }), pdfAsFile]) ? (
                  <button type="button" className="btn btn-secondary" onClick={() => void sharePdf(true)}>
                    Share card with the PDF…
                  </button>
                ) : null}
              </>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={() => void makeCard()}>
                Make a summary card
              </button>
            )}
            <p className="file-facts">One phone-width image with the period, scope and total — sent with the report, never instead of it.</p>
            <p className="file-facts" role="status" aria-live="polite">
              {status}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
