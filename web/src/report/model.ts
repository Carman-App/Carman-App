/**
 * The report document model — what the engine produces and every renderer
 * (HTML reading view, PDF, summary card) consumes.
 *
 * A report is one document whose body assembles itself: the engine decides
 * which sections the records can support, and states what it left out and
 * why. Sections are composed from a small set of blocks so that renderers
 * implement a handful of primitives rather than every section twice.
 *
 * Everything here is plain data — strings already formatted for the reader's
 * conventions — so rendering never re-derives a number.
 */

export type ReportKind = 'expense' | 'work'

/** Visual emphasis. Renderers must never carry meaning by colour alone (RECIP-06). */
export type Tone = 'default' | 'muted' | 'warning' | 'strong'

export type Cell = string | { text: string; sub?: string; tone?: Tone }

export type Column = {
  key: string
  label: string
  align?: 'left' | 'right'
  /** Relative width; defaults to 1. */
  width?: number
}

export type Row = {
  cells: Record<string, Cell>
  tone?: Tone
  /** Short annotations printed under the row (edited, entered late, possible duplicate…). */
  marks?: string[]
}

export type BarRow = {
  label: string
  sub?: string
  value: string
  share?: string
  /** 0..1 — length of the bar relative to the largest row. */
  fraction: number
  tone?: Tone
}

export type StackSegment = {
  label: string
  value: string
  /** 0..1 share of the whole bar. */
  fraction: number
  /** Fills that survive black-and-white printing (RECIP-06). */
  fill: 'solid' | 'mid' | 'light' | 'hatch'
}

export type Block =
  | { kind: 'figure'; label: string; value: string; caption?: string }
  | { kind: 'stats'; items: { label: string; value: string; caption?: string; tone?: Tone }[] }
  | { kind: 'bars'; rows: BarRow[]; caption?: string }
  | { kind: 'stack'; segments: StackSegment[]; caption?: string }
  | { kind: 'table'; columns: Column[]; rows: Row[]; footer?: Row; caption?: string }
  | { kind: 'facts'; items: { label: string; value: string; tone?: Tone }[] }
  | { kind: 'note'; text: string; tone?: Tone }
  | { kind: 'list'; items: string[] }

export type Section = {
  id: string
  title: string
  /** Story ids from the brief this section answers — kept for traceability, not printed. */
  stories: string[]
  blocks: Block[]
}

/** A section the records could not support, and the reason given to the reader. */
export type Omission = { title: string; reason: string }

export type ScopeLine = { label: string; value: string }

export type ReportDoc = {
  kind: ReportKind
  /** Document format version — bump when the layout of an archived document would change. */
  version: 1
  title: string
  /** Garage, vehicle or workshop the report is about. */
  subject: string
  subjectDetail?: string
  periodLabel: string
  periodRange: string
  /** The scope statement (RECIP-07, SYS-02): every choice and filter, never silent. */
  scope: ScopeLine[]
  /** The sender's own words (SYS-14). */
  note?: { from: string; text: string }
  /** Named sender and a route back (RECIP-09). */
  contact?: { name: string; detail?: string }
  generated: {
    atLabel: string
    by: string
    dataAsOfLabel: string
  }
  /** Shown on the summary card and the first page. */
  headline: { label: string; value: string; caption: string }
  /** Top lines for the summary card (largest first). */
  highlights: BarRow[]
  sections: Section[]
  omitted: Omission[]
  /** Stated once: currency, units, rounding, earlier versions. */
  notes: string[]
  /** Contents block once the document is long enough to need one (SYS-12). */
  showContents: boolean
  filename: string
  /** Deterministic content hash — same inputs, same fingerprint (SYS-05). */
  fingerprint: string
  /** Parameters that identify "the same report" across generations. */
  identity: string
  recordCount: number
}
