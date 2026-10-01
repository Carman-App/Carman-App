import { TEXT_STEPS as STEPS } from '../data/textScale.ts'

export function TextSize({ scale, onChange }: { scale: number; onChange: (n: number) => void }) {
  const i = Math.max(0, STEPS.indexOf(scale))
  return (
    <div className="text-size" role="group" aria-label="Text size">
      <button type="button" onClick={() => onChange(STEPS[Math.max(0, i - 1)]!)} disabled={i === 0} aria-label="Smaller text">
        A−
      </button>
      <button type="button" onClick={() => onChange(STEPS[Math.min(STEPS.length - 1, i + 1)]!)} disabled={i === STEPS.length - 1} aria-label="Larger text">
        A+
      </button>
    </div>
  )
}
