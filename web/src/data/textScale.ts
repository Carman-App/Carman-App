import { useState } from 'react'
import { recall, remember } from './presets.ts'

export const TEXT_STEPS = [0.9, 1, 1.15, 1.3, 1.5]
const STEPS = TEXT_STEPS

/** Larger type for the reading view (REACH-04), remembered on this device. */
export function useTextScale(): [number, (n: number) => void] {
  const [scale, setScale] = useState(() => {
    const saved = recall('textScale')
    return saved && STEPS.includes(saved) ? saved : 1
  })
  return [
    scale,
    (n: number) => {
      setScale(n)
      remember('textScale', n)
    },
  ]
}
