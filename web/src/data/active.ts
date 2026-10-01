import { recall } from './presets.ts'
import { useGarages, useWorkshops } from './queries.ts'

/** The garage a report is about: the one in the URL, else the last one used, else the first. */
export function useActiveGarage(requested: string | null) {
  const garages = useGarages()
  const list = garages.data?.data ?? []
  const has = (id: string | null | undefined) => !!id && list.some((g) => g.id === id)
  const remembered = recall('garageId')
  const id = has(requested) ? requested : has(remembered) ? remembered! : (list[0]?.id ?? null)
  return { garages, list, id }
}

/** The workshop a work report is about, chosen the same way. */
export function useActiveWorkshop(requested: string | null) {
  const workshops = useWorkshops()
  const list = workshops.data?.data ?? []
  const has = (id: string | null | undefined) => !!id && list.some((w) => w.id === id)
  const remembered = recall('workshopId')
  const id = has(requested) ? requested : has(remembered) ? remembered! : (list[0]?.id ?? null)
  return { workshops, list, id }
}
