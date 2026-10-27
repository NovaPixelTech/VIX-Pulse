import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatPercent(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)}%`
}

export function formatCurrency(value: number | null | undefined, currency = 'USD', decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function getChartTheme(theme: 'dark' | 'light') {
  const dark = theme === 'dark'
  return {
    text: dark ? 'hsl(210 40% 98%)' : 'hsl(222 47% 11%)',
    muted: dark ? 'hsl(215 20% 65%)' : 'hsl(215 16% 47%)',
    border: dark ? 'hsl(217 33% 17%)' : 'hsl(214 32% 91%)',
    tooltipBg: dark ? 'hsl(222 47% 8%)' : 'hsl(0 0% 100%)',
    tooltipBorder: dark ? 'hsl(217 33% 17%)' : 'hsl(214 32% 91%)',
  }
}

export function fuzzySearch<T extends { name?: string; ticker?: string; isin?: string }>(
  query: string,
  items: T[],
): T[] {
  if (!query.trim()) return items
  const q = query.toLowerCase()
  return items.filter(
    (item) =>
      item.name?.toLowerCase().includes(q) ||
      item.ticker?.toLowerCase().includes(q) ||
      item.isin?.toLowerCase().includes(q),
  )
}
