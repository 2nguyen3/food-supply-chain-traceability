import { useSyncExternalStore } from 'react'

export type RoleHistoryAction = 'revoke' | 'grant'

export interface RoleHistoryEntry {
  id: number
  action: RoleHistoryAction
  name: string
  role: string
  time: string
  date: string
}

const STORAGE_KEY = 'cocomark.admin.roleHistory'

function loadHistory(): RoleHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is RoleHistoryEntry =>
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as RoleHistoryEntry).id === 'number' &&
        typeof (entry as RoleHistoryEntry).name === 'string',
    )
  } catch {
    return []
  }
}

let history: RoleHistoryEntry[] = loadHistory()
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

export function getRoleHistory() {
  return history
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

export function recordRoleChange(
  entry: Omit<RoleHistoryEntry, 'time' | 'date' | 'id'> & { id?: number },
) {
  const now = new Date()
  const record: RoleHistoryEntry = {
    id: entry.id ?? now.getTime(),
    action: entry.action,
    name: entry.name,
    role: entry.role,
    time: formatTime(now),
    date: formatDate(now),
  }
  history = [record, ...history]
  // Demo: giữ tối đa 50 dòng gần nhất.
  history = history.slice(0, 50)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch {
    // Bỏ qua nếu trình duyệt chặn localStorage.
  }
  emit()
}

export function clearRoleHistory() {
  history = []
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Bỏ qua nếu trình duyệt chặn localStorage.
  }
  emit()
}

export function useRoleHistory() {
  return useSyncExternalStore(subscribe, getRoleHistory, getRoleHistory)
}

// Đồng bộ khi localStorage bị thay đổi từ tab khác (storage event).
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) {
    history = loadHistory()
    emit()
  }
})
