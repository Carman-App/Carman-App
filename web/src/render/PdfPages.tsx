// The legacy build carries polyfills: the modern one needs JavaScript
// built-ins (Map.prototype.getOrInsertComputed) that the older browsers on
// many phones don't have yet.
import { GlobalWorkerOptions, getDocument, type PDFDocumentLoadingTask } from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { useEffect, useRef, useState } from 'react'

GlobalWorkerOptions.workerSrc = workerUrl

/**
 * The paginated preview (SYS-10), drawn page by page with pdf.js from the
 * exact bytes that will be sent. Most phones have no built-in PDF viewer
 * that works inside a page, so the app draws the pages itself rather than
 * relying on one.
 */
export default function PdfPages({ blob, title }: { blob: Blob; title: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<{ pages: number; error: string | null }>({ pages: 0, error: null })

  useEffect(() => {
    const el = host.current
    if (!el) return
    let cancelled = false
    let task: PDFDocumentLoadingTask | null = null
    el.replaceChildren()
    void (async () => {
      try {
        task = getDocument({ data: new Uint8Array(await blob.arrayBuffer()) })
        const pdf = await task.promise
        if (cancelled) return
        setState({ pages: pdf.numPages, error: null })
        const ratio = Math.min(2, window.devicePixelRatio || 1)
        const available = Math.max(240, el.clientWidth - 32)
        for (let n = 1; n <= pdf.numPages && !cancelled; n += 1) {
          const page = await pdf.getPage(n)
          const cssScale = Math.min(1.6, available / page.getViewport({ scale: 1 }).width)
          const viewport = page.getViewport({ scale: cssScale * ratio })
          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          canvas.style.width = `${Math.floor(viewport.width / ratio)}px`
          canvas.setAttribute('role', 'img')
          canvas.setAttribute('aria-label', `Page ${n} of ${pdf.numPages}`)
          const figure = document.createElement('figure')
          const caption = document.createElement('figcaption')
          caption.textContent = `Page ${n} of ${pdf.numPages}`
          figure.append(canvas, caption)
          if (cancelled) return
          el.append(figure)
          await page.render({ canvas, viewport }).promise
        }
      } catch (error) {
        if (cancelled) return
        el.replaceChildren()
        setState({ pages: 0, error: `The pages couldn’t be drawn here (${error instanceof Error ? error.message : 'unknown error'}). Open the PDF in a new tab to check it instead.` })
      }
    })()
    return () => {
      cancelled = true
      void task?.destroy()
    }
  }, [blob])

  return (
    <div className="pdf-pages" role="region" aria-label={`Preview of ${title}`} aria-busy={state.pages === 0 && !state.error}>
      {state.error ? (
        <p className="banner warning" role="alert">
          {state.error}
        </p>
      ) : null}
      <div ref={host} className="pdf-pages-list" />
    </div>
  )
}
