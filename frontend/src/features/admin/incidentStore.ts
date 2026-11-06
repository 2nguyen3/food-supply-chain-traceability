import { useSyncExternalStore } from 'react'

export interface RecallRecord {
  batchCode: string
  incidentId: string
  reason: string
  reasonCid: string
  txHash: string
  time: string
  scope: string
}

const STORAGE_KEY = 'cocomark.admin.recalls'

function loadRecalls(): Record<string, RecallRecord> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Record<string, RecallRecord>
  } catch {
    return {}
  }
}

let recalls: Record<string, RecallRecord> = loadRecalls()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getRecalls() {
  return recalls
}

export function recordRecall(record: RecallRecord) {
  recalls = { ...recalls, [record.batchCode]: record }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recalls))
  } catch {
    // Bỏ qua nếu trình duyệt chặn localStorage.
  }
  emit()
}

// Đồng bộ khi localStorage bị thay đổi từ tab khác (storage event).
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) {
    recalls = loadRecalls()
    emit()
  }
})

export function useRecalls() {
  return useSyncExternalStore(subscribe, getRecalls, getRecalls)
}
