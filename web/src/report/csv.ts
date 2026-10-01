import { recordDetail, recordTitle, vehicleName, type OwnerDataset } from './dataset.ts'
import { selectExpense, type ExpenseParams } from './expense.ts'
import { makeFmt } from './fmt.ts'
import { minorToDecimalString } from './money.ts'
import { scrubAmounts } from './text.ts'
import { JOB_STATUS_LABEL, invoiceRef, selectWork, type WorkParams } from './work.ts'
import type { WorkDataset } from './workDataset.ts'

/**
 * Spreadsheet exports (FLEET-13, RECIP-03): one row per record, stable
 * snake_case headers, ISO dates, unformatted amounts with a currency column
 * — the same rows as the document's line items, so they sum to the same
 * total. The PDF is for reading; the CSV is for working.
 */

function cell(value: string | number | null | undefined): string {
  if (value == null) return ''
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  // UTF-8 byte-order mark so spreadsheet apps read accented names correctly; CRLF per RFC 4180.
  return `﻿${[header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`
}

export function expenseCsv(data: OwnerDataset, params: ExpenseParams, today: string): string {
  const sel = selectExpense(data, params, today)
  const vehicles = new Map(data.vehicles.map((v) => [v.id, v]))
  const header = [
    'record_id',
    'date',
    'vehicle_id',
    'vehicle',
    'plate',
    'record_type',
    'category',
    'item',
    'detail',
    'place',
    'entered_by',
    'former_member',
    'entered_at',
    'edited_at',
    'odometer_km',
    'litres',
    ...(params.hideAmounts ? [] : ['amount', 'currency']),
  ]
  const rows = sel.items.map((r) => {
    const v = vehicles.get(r.vehicleId)
    return [
      r.id,
      r.date,
      r.vehicleId,
      v ? vehicleName(v) : '',
      v?.plate ?? '',
      r.type,
      r.category ?? '',
      params.hideAmounts ? scrubAmounts(recordTitle(r), data.conventions.currency) : recordTitle(r),
      (() => {
        const detail = r.type === 'repair' ? r.notes : recordDetail(r)
        return detail && params.hideAmounts ? scrubAmounts(detail, data.conventions.currency) : detail
      })(),
      r.place,
      r.enteredByName,
      sel.person(r).former ? 'yes' : 'no',
      r.createdAt,
      r.editedAt,
      r.odometerKm,
      r.litres,
      ...(params.hideAmounts ? [] : [minorToDecimalString(r.amount), data.conventions.currency]),
    ]
  })
  return toCsv(header, rows)
}

export function workCsv(data: WorkDataset, params: WorkParams, today: string, timeZone?: string): string {
  const fmt = makeFmt(data.conventions, { fractionDigits: 2, timeZone })
  const sel = selectWork(data, params, today, fmt.stampIso)
  const customers = new Map(data.customers.map((c) => [c.id, c]))
  const members = new Map(data.members.map((m) => [m.id, m.name]))
  const firstInvoice = new Map<string, (typeof sel.invoices)[number]>()
  for (const inv of sel.invoices) if (!firstInvoice.has(inv.jobId)) firstInvoice.set(inv.jobId, inv)
  const header = [
    'job_id',
    'date_in',
    'customer',
    'customer_phone',
    'vehicle',
    'job',
    'mechanics',
    'status',
    'invoice_ref',
    'invoice_date',
    'invoiced',
    'paid',
    'outstanding',
    'turnaround_days',
    'currency',
  ]
  const rows = sel.jobsInPeriod.map((j) => {
    const inv = firstInvoice.get(j.id)
    const paid = inv ? Math.min(inv.payments.reduce((s, p) => s + p.amount, 0), inv.total) : 0
    return [
      j.id,
      fmt.stampIso(j.createdAt),
      customers.get(j.customerId)?.name ?? '',
      customers.get(j.customerId)?.phone ?? '',
      j.vehicleLabel,
      j.fault,
      j.mechanicIds.map((m) => members.get(m) ?? 'former staff').join('; '),
      JOB_STATUS_LABEL[j.status] ?? j.status,
      inv ? invoiceRef(inv.id) : '',
      inv ? fmt.stampIso(inv.createdAt) : '',
      inv ? minorToDecimalString(inv.total) : '',
      inv ? minorToDecimalString(paid) : '',
      inv ? minorToDecimalString(inv.total - paid) : '',
      inv ? ((Date.parse(inv.createdAt) - Date.parse(j.createdAt)) / 86_400_000).toFixed(1) : '',
      data.conventions.currency,
    ]
  })
  return toCsv(header, rows)
}
