export function loadThreshold(key: string, defaultValue: number): number {
  try {
    if (typeof window === 'undefined') return defaultValue
    const raw = window.localStorage.getItem(`vix-${key}`)
    if (!raw) return defaultValue
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : defaultValue
  } catch {
    return defaultValue
  }
}

export function saveThreshold(key: string, value: number) {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(`vix-${key}`, String(value))
  } catch {
    // ignore
  }
}

export function loadDate(key: string, defaultValue: string): string {
  try {
    if (typeof window === 'undefined') return defaultValue
    const raw = window.localStorage.getItem(`vix-date-${key}`)
    return raw || defaultValue
  } catch {
    return defaultValue
  }
}

export function saveDate(key: string, value: string) {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(`vix-date-${key}`, value)
  } catch {
    // ignore
  }
}

function normalizeDateString(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  // If already YYYY-MM-DD, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  // If DD.MM.YYYY format
  const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (dotMatch) {
    const [, day, month, year] = dotMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  // Try to parse as-is and format
  const date = new Date(trimmed)
  if (!Number.isNaN(date.getTime())) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
  return trimmed
}

export function formatDateInput(value: string): string {
  return normalizeDateString(value)
}
