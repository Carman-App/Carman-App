/**
 * Saved report setups (SYS-13) and small remembered conveniences, kept in
 * this browser's localStorage. Every access is guarded: storage can be
 * missing or blocked, and the app must work without it.
 */

export type PresetKind = 'expense' | 'work'
export type Preset = { id: string; kind: PresetKind; name: string; query: string }

const PRESETS_KEY = 'carma:presets:v1'
const MEMORY_KEY = 'carma:memory:v1'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage blocked or full — presets are a convenience, not a requirement
  }
}

export function loadPresets(kind: PresetKind): Preset[] {
  return read<Preset[]>(PRESETS_KEY, []).filter((p) => p.kind === kind)
}

export function savePreset(kind: PresetKind, name: string, query: string): Preset {
  const preset: Preset = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, kind, name: name.trim().slice(0, 40), query }
  write(PRESETS_KEY, [...read<Preset[]>(PRESETS_KEY, []), preset])
  return preset
}

export function deletePreset(id: string) {
  write(
    PRESETS_KEY,
    read<Preset[]>(PRESETS_KEY, []).filter((p) => p.id !== id),
  )
}

type Memory = { contact?: string; garageId?: string; workshopId?: string; textScale?: number; ratePerKm?: string }

export function remember<K extends keyof Memory>(key: K, value: Memory[K]) {
  write(MEMORY_KEY, { ...read<Memory>(MEMORY_KEY, {}), [key]: value })
}

export function recall<K extends keyof Memory>(key: K): Memory[K] | undefined {
  return read<Memory>(MEMORY_KEY, {})[key]
}
