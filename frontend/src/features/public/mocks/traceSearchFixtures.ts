const DEMO_CODES = ['COCONUT-001', 'COCONUT-002', 'COCONUT-003', 'COCONUT-004'] as const

export const TRACE_DEMO_CODES: readonly string[] = DEMO_CODES

const tokenToCode = new Map(DEMO_CODES.map((code, index) => [String(index + 1), code]))
const knownCodes = new Set<string>(DEMO_CODES)

export function findDemoCode(value: string): string | null {
  const query = value.trim().toUpperCase()
  if (knownCodes.has(query)) return query
  return tokenToCode.get(query.replace(/^#/, '')) ?? null
}
