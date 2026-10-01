import { pdf } from '@react-pdf/renderer'
import type { ReportDoc } from '../report/model.ts'
import { ReportPdf } from './ReportPdf.tsx'

/**
 * Entry point for the PDF renderer — loaded on demand, since react-pdf is
 * the heaviest part of the app and only needed when a report is exported.
 */

/** Count pages straight from the file, so the export panel can say what will be sent. */
async function countPages(blob: Blob): Promise<number> {
  const text = new TextDecoder('latin1').decode(await blob.arrayBuffer())
  return (text.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length
}

export async function renderPdf(doc: ReportDoc, generatedAt: Date): Promise<{ blob: Blob; pages: number }> {
  const blob = await pdf(<ReportPdf doc={doc} generatedAt={generatedAt} />).toBlob()
  return { blob, pages: await countPages(blob) }
}
