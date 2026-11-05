import type { DemoBatch, DemoEvent } from '../../public/mocks/traceDetailFixtures'

export const FARMER_PRIVATE_INVOICE = {
  batchCode: 'COCONUT-001',
  name: 'hoa-don-si-COCONUT-001.pdf',
  number: 'HDB-0001',
  documentId: 'DOC-001',
} as const

export function farmerPreviewEvents(batch: DemoBatch): DemoEvent[] {
  return batch.events.flatMap((event) => {
    if (event.kind !== 'TransitRecorded') return [event]
    return batch.readings.map((reading) => ({
      id: `${batch.code}-transit-${reading.id}`,
      kind: 'TransitRecorded' as const,
      at: reading.observedAt,
      detail: `Bản ghi vận chuyển #${reading.id}: ${reading.temperatureC}°C${reading.temperatureC > (batch.maxTemperatureC ?? Infinity) ? ' · vượt ngưỡng mô phỏng' : ''}.`,
    }))
  })
}

export function downloadPreviewInvoice(batch: DemoBatch): void {
  const invoice = FARMER_PRIVATE_INVOICE
  const lines = [
    'COCOMARK - SAMPLE WHOLESALE INVOICE',
    'PREVIEW ONLY - NO LEGAL VALUE',
    `Invoice: ${invoice.number}`,
    `Batch: ${batch.code}`,
    `Farm: ${batch.farmId}`,
    'Quantity: 1000 kg whole coconuts',
    'No blockchain transaction or ACL proof is included.',
  ]
  const content = `BT /F1 16 Tf 50 760 Td (${lines[0]}) Tj /F1 11 Tf ${lines.slice(1).map((line) => `0 -28 Td (${line}) Tj`).join(' ')} ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  }
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = invoice.name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
