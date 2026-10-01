import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import groteskBold from '@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff?url'
import groteskMedium from '@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff?url'
import groteskRegular from '@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff?url'
import groteskSemi from '@fontsource/space-grotesk/files/space-grotesk-latin-600-normal.woff?url'
import monoBold from '@fontsource/space-mono/files/space-mono-latin-700-normal.woff?url'
import monoRegular from '@fontsource/space-mono/files/space-mono-latin-400-normal.woff?url'
import type { Block, Cell, Column, ReportDoc, Row, Tone } from '../report/model.ts'

/**
 * The fixed document — an A4 PDF that stands alone (RECIP-01): every page
 * carries what it is and "page n of m", table headers repeat on every page
 * and rows never split (SYS-12), nothing is set below 9pt, and meaning is
 * carried by rules, weight and position, with fills that survive a
 * black-and-white office printer (RECIP-06). Fonts are embedded and
 * subset, which keeps a text-only report well under a megabyte (RECIP-05).
 */

Font.register({
  family: 'Grotesk',
  fonts: [
    { src: groteskRegular, fontWeight: 400 },
    { src: groteskMedium, fontWeight: 500 },
    { src: groteskSemi, fontWeight: 600 },
    { src: groteskBold, fontWeight: 700 },
  ],
})
Font.register({
  family: 'Mono',
  fonts: [
    { src: monoRegular, fontWeight: 400 },
    { src: monoBold, fontWeight: 700 },
  ],
})
// Hyphenating plates, part numbers and amounts would change what they say.
Font.registerHyphenationCallback((word) => [word])

const C = {
  ink: '#111111',
  ink2: '#3F3F3B',
  muted: '#5C5C56',
  rule: '#D3D2CC',
  strong: '#111111',
  accent: '#1F4FD8',
  warning: '#8A5A00',
  warningFill: '#B8770B',
  bar: '#111111',
  track: '#E4E3DD',
  mid: '#77776F',
  light: '#CFCEC7',
}

const MIN = 9

const s = StyleSheet.create({
  // No lineHeight on the page or any View: react-pdf's page-template
  // measurement inherits it into the flow region and comes out short, and
  // inherited through Views it inflates rows. Prose styles set their own.
  page: { paddingTop: 48, paddingBottom: 26, paddingHorizontal: 50, fontFamily: 'Grotesk', fontSize: 10, color: C.ink },
  frame: { flexGrow: 1, flexDirection: 'column' },
  flow: { flexGrow: 1 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.75, borderTopColor: C.rule, paddingTop: 6, marginTop: 14 },
  footerText: { fontFamily: 'Mono', fontSize: MIN, color: C.muted, letterSpacing: 0.4 },
  kicker: { fontFamily: 'Mono', fontSize: MIN, color: C.muted, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 10 },
  title: { fontSize: 26, fontWeight: 600, letterSpacing: -0.6, lineHeight: 1.08 },
  subtitle: { fontSize: 11, color: C.ink2, marginTop: 4 },
  period: { fontSize: 12, marginTop: 10 },
  periodRange: { color: C.muted },
  strongRule: { borderTopWidth: 1.5, borderTopColor: C.strong, marginTop: 16, marginBottom: 14 },
  note: { borderLeftWidth: 2.5, borderLeftColor: C.accent, paddingLeft: 12, marginBottom: 14 },
  label: { fontFamily: 'Mono', fontSize: MIN, color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  noteText: { fontSize: 11, lineHeight: 1.35 },
  scopeRow: { flexDirection: 'row', marginBottom: 4 },
  scopeLabel: { width: 82, fontFamily: 'Mono', fontSize: MIN, color: C.muted, letterSpacing: 0.6, textTransform: 'uppercase', paddingTop: 1 },
  scopeValue: { flex: 1, fontSize: 10, lineHeight: 1.35 },
  block: { marginTop: 10 },
  section: { marginTop: 18 },
  sectionHead: { borderTopWidth: 0.75, borderTopColor: C.rule, paddingTop: 10, flexDirection: 'row' },
  sectionTitle: { fontFamily: 'Mono', fontSize: 9.5, color: C.muted, letterSpacing: 1.6, textTransform: 'uppercase' },
  sectionNum: { color: C.accent },
  figureLabel: { fontFamily: 'Mono', fontSize: MIN, color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase' },
  figureValue: { fontSize: 30, fontWeight: 600, letterSpacing: -0.8, lineHeight: 1.1, marginTop: 4 },
  figureCaption: { fontSize: 10, color: C.ink2, marginTop: 2 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { width: '25%', paddingRight: 10, marginBottom: 6, borderTopWidth: 0.75, borderTopColor: C.rule, paddingTop: 5 },
  statLabel: { fontFamily: 'Mono', fontSize: MIN, color: C.muted, letterSpacing: 0.4, textTransform: 'uppercase' },
  statValue: { fontSize: 14, fontWeight: 600, marginTop: 2 },
  statCaption: { fontSize: MIN, color: C.muted },
  barRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: C.rule },
  barLabel: { width: '36%', paddingRight: 8 },
  barTrack: { flex: 1, height: 7, backgroundColor: C.track },
  barFill: { height: 7, backgroundColor: C.bar },
  barValue: { width: '18%', textAlign: 'right', fontFamily: 'Mono', fontSize: MIN },
  barShare: { width: '9%', textAlign: 'right', fontFamily: 'Mono', fontSize: MIN, color: C.muted },
  sub: { fontSize: MIN, color: C.muted },
  stackBar: { flexDirection: 'row', height: 16, borderWidth: 0.75, borderColor: C.strong },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 3 },
  legendSwatch: { width: 9, height: 9, borderWidth: 0.75, borderColor: C.strong, marginRight: 5 },
  table: { marginTop: 10 },
  thead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.strong, paddingBottom: 3 },
  th: { fontFamily: 'Mono', fontSize: MIN, color: C.muted, letterSpacing: 0.4, textTransform: 'uppercase', paddingRight: 6 },
  tr: { borderBottomWidth: 0.5, borderBottomColor: C.rule, paddingVertical: 3.5 },
  trCells: { flexDirection: 'row' },
  td: { fontSize: MIN },
  tdNum: { fontFamily: 'Mono', fontSize: MIN, textAlign: 'right' },
  marks: { fontSize: MIN, color: C.muted, marginTop: 2, fontStyle: 'normal' },
  tfoot: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.strong, paddingTop: 4 },
  caption: { fontSize: MIN, color: C.muted, marginTop: 5, lineHeight: 1.35 },
  factRow: { flexDirection: 'row', marginBottom: 3 },
  factLabel: { width: '34%', color: C.muted, paddingRight: 8 },
  factValue: { flex: 1 },
  noteBlock: { fontSize: 9.5, color: C.ink2, lineHeight: 1.35 },
  noteMuted: { fontSize: MIN, color: C.muted, lineHeight: 1.35 },
  noteWarning: { fontSize: 9.5, color: C.warning, borderLeftWidth: 2, borderLeftColor: C.warningFill, paddingLeft: 8, lineHeight: 1.35 },
  listItem: { flexDirection: 'row', marginBottom: 2 },
  bullet: { width: 10, color: C.muted },
  end: { borderTopWidth: 1.5, borderTopColor: C.strong, marginTop: 22, paddingTop: 8 },
  endText: { fontSize: MIN, color: C.muted, marginBottom: 4, lineHeight: 1.35 },
})

const pad = (n: number) => String(n).padStart(2, '0')
const cellText = (c: Cell | undefined) => (c == null ? '' : typeof c === 'string' ? c : c.text)
const cellSub = (c: Cell | undefined) => (c != null && typeof c !== 'string' ? c.sub : undefined)
const toneColor = (t?: Tone) => (t === 'warning' ? C.warning : t === 'muted' ? C.muted : undefined)

const FILL: Record<string, { backgroundColor: string; borderColor?: string }> = {
  solid: { backgroundColor: C.bar },
  mid: { backgroundColor: C.mid },
  light: { backgroundColor: C.light },
  // Outlined white reads as distinct from every grey on a mono printer.
  hatch: { backgroundColor: '#FFFFFF' },
}

function PdfTable({ columns, rows, footer, caption }: { columns: Column[]; rows: Row[]; footer?: Row; caption?: string }) {
  const cells = (row: Row, bold = false) =>
    columns.map((c) => {
      const cell = row.cells[c.key]
      const sub = cellSub(cell)
      const color = toneColor(typeof cell === 'object' ? cell.tone : undefined) ?? toneColor(row.tone)
      const numeric = c.align === 'right'
      return (
        <View key={c.key} style={{ flex: c.width ?? 1, paddingRight: 6 }}>
          {/* Mono ships 400/700 only, so bold figures use 700. */}
          <Text style={[numeric ? s.tdNum : s.td, color ? { color } : {}, bold ? { fontWeight: numeric ? 700 : 600 } : {}]}>{cellText(cell)}</Text>
          {sub ? <Text style={[s.sub, { textAlign: numeric ? 'right' : 'left' }]}>{sub}</Text> : null}
        </View>
      )
    })
  return (
    <View style={s.table}>
      <View style={s.thead} fixed>
        {columns.map((c) => (
          <Text key={c.key} style={[s.th, { flex: c.width ?? 1, textAlign: c.align === 'right' ? 'right' : 'left' }]}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((row, i) => (
        <View key={i} style={s.tr} wrap={false}>
          <View style={s.trCells}>{cells(row)}</View>
          {row.marks && row.marks.length > 0 ? <Text style={s.marks}>{row.marks.join(' · ')}</Text> : null}
        </View>
      ))}
      {footer ? (
        <View style={s.tfoot} wrap={false}>
          {cells(footer, true)}
        </View>
      ) : null}
      {caption ? <Text style={s.caption}>{caption}</Text> : null}
    </View>
  )
}

function PdfBlock({ block }: { block: Block }): ReactElement {
  switch (block.kind) {
    case 'figure':
      return (
        <View style={s.block} wrap={false}>
          <Text style={s.figureLabel}>{block.label}</Text>
          <Text style={s.figureValue}>{block.value}</Text>
          {block.caption ? <Text style={s.figureCaption}>{block.caption}</Text> : null}
        </View>
      )
    case 'stats':
      return (
        <View style={[s.block, s.statsRow]} wrap={false}>
          {block.items.map((item) => (
            <View key={item.label} style={s.stat}>
              <Text style={s.statLabel}>{item.label}</Text>
              <Text style={[s.statValue, item.tone === 'warning' ? { color: C.warning } : {}]}>{item.value}</Text>
              {item.caption ? <Text style={s.statCaption}>{item.caption}</Text> : null}
            </View>
          ))}
        </View>
      )
    case 'bars':
      return (
        <View style={s.block}>
          {block.rows.map((row) => (
            <View key={row.label} style={s.barRow} wrap={false}>
              <View style={s.barLabel}>
                <Text style={[{ fontSize: 10 }, row.tone === 'muted' ? { color: C.muted } : {}]}>{row.label}</Text>
                {row.sub ? <Text style={s.sub}>{row.sub}</Text> : null}
              </View>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${Math.max(0, Math.min(1, row.fraction)) * 100}%` }, row.tone === 'warning' ? { backgroundColor: C.warningFill } : {}]} />
              </View>
              <Text style={s.barValue}>{row.value}</Text>
              <Text style={s.barShare}>{row.share ?? ''}</Text>
            </View>
          ))}
          {block.caption ? <Text style={s.caption}>{block.caption}</Text> : null}
        </View>
      )
    case 'stack':
      return (
        <View style={s.block} wrap={false}>
          <View style={s.stackBar}>
            {block.segments
              .filter((seg) => seg.fraction > 0)
              .map((seg, i) => (
                <View key={seg.label} style={[{ width: `${seg.fraction * 100}%`, height: '100%' }, FILL[seg.fill]!, seg.fill === 'hatch' && i > 0 ? { borderLeftWidth: 0.75, borderLeftColor: C.strong } : {}]} />
              ))}
          </View>
          <View style={s.legendRow}>
            {block.segments.map((seg) => (
              <View key={seg.label} style={s.legendItem}>
                <View style={[s.legendSwatch, FILL[seg.fill]!]} />
                <Text style={{ fontSize: MIN }}>
                  {seg.label} <Text style={{ fontFamily: 'Mono' }}>{seg.value}</Text>
                </Text>
              </View>
            ))}
          </View>
          {block.caption ? <Text style={s.caption}>{block.caption}</Text> : null}
        </View>
      )
    case 'table':
      return <PdfTable columns={block.columns} rows={block.rows} footer={block.footer} caption={block.caption} />
    case 'facts':
      return (
        <View style={s.block}>
          {block.items.map((f) => (
            <View key={f.label} style={s.factRow} wrap={false}>
              <Text style={s.factLabel}>{f.label}</Text>
              <Text style={[s.factValue, f.tone === 'warning' ? { color: C.warning } : {}]}>{f.value}</Text>
            </View>
          ))}
        </View>
      )
    case 'note':
      return (
        <View style={s.block} wrap={false}>
          <Text style={block.tone === 'warning' ? s.noteWarning : block.tone === 'muted' ? s.noteMuted : s.noteBlock}>{block.text}</Text>
        </View>
      )
    case 'list':
      return (
        <View style={s.block}>
          {block.items.map((item) => (
            <View key={item} style={s.listItem} wrap={false}>
              <Text style={s.bullet}>•</Text>
              <Text style={{ flex: 1, fontSize: 9.5 }}>{item}</Text>
            </View>
          ))}
        </View>
      )
  }
}

export function ReportPdf({ doc, generatedAt }: { doc: ReportDoc; generatedAt: Date }) {
  const footerLabel = `Carma · ${doc.title} · ${doc.subject}`.toUpperCase().slice(0, 70)
  return (
    <Document
      title={doc.filename.replace(/\.pdf$/i, '')}
      author={doc.generated.by}
      subject={`${doc.title} — ${doc.subject}, ${doc.periodRange}`}
      creator="Carma Reports"
      producer="Carma"
      language="en"
      creationDate={generatedAt}
      modificationDate={generatedAt}
    >
      {/*
        Page chrome goes through the layout template rather than an absolutely
        positioned fixed footer: the template reserves its space on every page
        (so the footer can never print over content) and selects react-pdf's
        newer pagination engine, which also lays out long tables with
        repeating headers that the older engine fails on.
      */}
      <Page
        size="A4"
        style={s.page}
        wrap
        layout={({ children, pageNumber, totalPages }) => (
          <View style={s.frame}>
            <View style={s.flow}>{children}</View>
            <View style={s.footer}>
              <Text style={s.footerText}>{footerLabel}</Text>
              <Text style={s.footerText}>{`PAGE ${pageNumber ?? 1} OF ${totalPages ?? 1}`}</Text>
            </View>
          </View>
        )}
      >
        <Text style={s.kicker}>{`Carma · ${doc.title}`}</Text>
        <Text style={s.title}>{doc.subject}</Text>
        {doc.subjectDetail ? <Text style={s.subtitle}>{doc.subjectDetail}</Text> : null}
        <Text style={s.period}>
          {doc.periodLabel} <Text style={s.periodRange}>· {doc.periodRange}</Text>
        </Text>
        <View style={s.strongRule} />

        {doc.note ? (
          <View style={s.note} wrap={false}>
            <Text style={s.label}>{`A note from ${doc.note.from}`}</Text>
            <Text style={s.noteText}>{doc.note.text}</Text>
          </View>
        ) : null}

        <Text style={s.label}>What this report covers</Text>
        {doc.scope.map((line) => (
          <View key={line.label} style={s.scopeRow} wrap={false}>
            <Text style={s.scopeLabel}>{line.label}</Text>
            <Text style={s.scopeValue}>{line.value}</Text>
          </View>
        ))}

        {doc.omitted.length > 0 ? (
          <View style={{ marginTop: 10 }}>
            <Text style={s.label}>Not in this report</Text>
            {doc.omitted.map((o) => (
              <View key={o.title} style={s.listItem} wrap={false}>
                <Text style={s.bullet}>•</Text>
                <Text style={{ flex: 1, fontSize: 9.5 }}>
                  <Text style={{ fontWeight: 600 }}>{o.title}. </Text>
                  {o.reason}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {doc.showContents ? (
          <View style={{ marginTop: 10 }} wrap={false}>
            <Text style={s.label}>Contents</Text>
            {doc.sections.map((sec, i) => (
              <Text key={sec.id} style={{ fontSize: 9.5 }}>
                <Text style={{ fontFamily: 'Mono', color: C.muted }}>{pad(i + 1)}  </Text>
                {sec.title}
              </Text>
            ))}
          </View>
        ) : null}

        {doc.sections.map((sec, i) => (
          <View key={sec.id} style={s.section}>
            <View style={s.sectionHead} minPresenceAhead={70}>
              <Text style={s.sectionTitle}>
                <Text style={s.sectionNum}>{pad(i + 1)}  </Text>
                {sec.title}
              </Text>
            </View>
            {sec.blocks.map((b, j) => (
              <PdfBlock key={j} block={b} />
            ))}
          </View>
        ))}

        <View style={s.end} wrap={false}>
          {doc.notes.map((n) => (
            <Text key={n} style={s.endText}>
              {n}
            </Text>
          ))}
          <Text style={s.endText}>{`Generated ${doc.generated.atLabel} by ${doc.generated.by}, from Carma records as of ${doc.generated.dataAsOfLabel}.`}</Text>
          {doc.contact ? <Text style={s.endText}>{`Questions about this report: ${doc.contact.name}${doc.contact.detail ? ` · ${doc.contact.detail}` : ''}.`}</Text> : null}
        </View>
      </Page>
    </Document>
  )
}
