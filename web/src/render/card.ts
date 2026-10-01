import type { ReportDoc } from '../report/model.ts'

/**
 * The summary card (REACH-05): one phone-width image carrying the period,
 * the scope and the total, for sharing the way people actually share — with
 * the full document sent behind it, never instead of it. Drawn on a canvas
 * so it needs nothing but the browser.
 */

const W = 1080
const PAD = 72
const INNER = W - PAD * 2
const INK = '#111111'
const INK2 = '#3F3F3B'
const MUTED = '#5C5C56'
const RULE = '#D3D2CC'
const TRACK = '#E4E3DD'
const GROTESK = '"Space Grotesk", system-ui, sans-serif'
const MONO = '"Space Mono", ui-monospace, monospace'

/** Scope lines worth carrying on the card: what it covers and any filter. */
const CARD_SCOPE = new Set(['Vehicle', 'Vehicles', 'Entered by', 'Places', 'Categories', 'Left out', 'Amounts', 'Mechanics', 'Customer'])

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width <= width || !line) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    let last = kept[maxLines - 1]!
    while (ctx.measureText(`${last}…`).width > width && last.length > 1) last = last.slice(0, -1)
    kept[maxLines - 1] = `${last.trimEnd()}…`
    return kept
  }
  return lines
}

function layout(ctx: CanvasRenderingContext2D, doc: ReportDoc, paint: boolean): number {
  let y = PAD + 24
  const text = (value: string, x: number, font: string, color: string, align: CanvasTextAlign = 'left', spacing = '0px') => {
    if (!paint) return
    ctx.font = font
    ctx.fillStyle = color
    ctx.textAlign = align
    ctx.letterSpacing = spacing
    ctx.fillText(value, x, y)
    ctx.letterSpacing = '0px'
  }
  const rule = (color: string, h: number) => {
    if (paint) {
      ctx.fillStyle = color
      ctx.fillRect(PAD, y, INNER, h)
    }
  }

  ctx.textBaseline = 'alphabetic'
  text(`CARMA · ${doc.title.toUpperCase()}`, PAD, `400 26px ${MONO}`, MUTED, 'left', '4px')
  y += 74

  ctx.font = `600 60px ${GROTESK}`
  for (const line of wrap(ctx, doc.subject, INNER, 2)) {
    text(line, PAD, `600 60px ${GROTESK}`, INK)
    y += 68
  }
  ctx.font = `400 32px ${GROTESK}`
  for (const line of wrap(ctx, `${doc.periodLabel} · ${doc.periodRange}`, INNER, 2)) {
    text(line, PAD, `400 32px ${GROTESK}`, INK2)
    y += 42
  }
  y += 14
  rule(INK, 3)
  y += 70

  text(doc.headline.label.toUpperCase(), PAD, `400 24px ${MONO}`, MUTED, 'left', '3px')
  y += 22
  let size = 150
  ctx.font = `600 ${size}px ${GROTESK}`
  while (ctx.measureText(doc.headline.value).width > INNER && size > 56) {
    size -= 4
    ctx.font = `600 ${size}px ${GROTESK}`
  }
  y += size * 0.92
  text(doc.headline.value, PAD, `600 ${size}px ${GROTESK}`, INK)
  y += 54
  text(doc.headline.caption, PAD, `400 32px ${GROTESK}`, INK2)
  y += 40

  if (doc.highlights.length > 0) {
    y += 34
    for (const h of doc.highlights.slice(0, 3)) {
      y += 34
      text(h.label, PAD, `500 30px ${GROTESK}`, INK)
      text(h.share ? `${h.value}  ${h.share}` : h.value, W - PAD, `400 28px ${MONO}`, INK, 'right')
      y += 18
      if (paint) {
        ctx.fillStyle = TRACK
        ctx.fillRect(PAD, y, INNER, 14)
        ctx.fillStyle = INK
        ctx.fillRect(PAD, y, Math.max(2, INNER * Math.max(0, Math.min(1, h.fraction))), 14)
      }
      y += 34
    }
  }

  const scope = doc.scope.filter((l) => CARD_SCOPE.has(l.label) && !(l.label === 'Entered by' && !l.value.startsWith('Only')))
  if (scope.length > 0) {
    y += 34
    rule(RULE, 2)
    y += 52
    text('SCOPE', PAD, `400 22px ${MONO}`, MUTED, 'left', '3px')
    y += 40
    ctx.font = `400 27px ${GROTESK}`
    for (const l of scope.slice(0, 4)) {
      for (const line of wrap(ctx, `${l.label}: ${l.value}`, INNER, 2)) {
        text(line, PAD, `400 27px ${GROTESK}`, INK2)
        y += 36
      }
      y += 6
    }
  }

  y += 30
  rule(RULE, 2)
  y += 56
  text('The full report is attached.', PAD, `500 28px ${GROTESK}`, INK)
  y += 40
  ctx.font = `400 21px ${MONO}`
  for (const line of wrap(ctx, `Generated ${doc.generated.atLabel} by ${doc.generated.by}`, INNER, 2)) {
    text(line, PAD, `400 21px ${MONO}`, MUTED)
    y += 30
  }
  return y + PAD - 30
}

export async function renderSummaryCard(doc: ReportDoc): Promise<Blob> {
  try {
    await Promise.all([
      document.fonts.load(`600 60px ${GROTESK}`),
      document.fonts.load(`500 30px ${GROTESK}`),
      document.fonts.load(`400 32px ${GROTESK}`),
      document.fonts.load(`400 26px ${MONO}`),
    ])
  } catch {
    // fall back to system fonts
  }
  const scratch = document.createElement('canvas').getContext('2d')
  if (!scratch) throw new Error('This browser cannot draw images.')
  const height = Math.ceil(layout(scratch, doc, false))
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, W, height)
  layout(ctx, doc, true)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image.'))), 'image/png'))
}
