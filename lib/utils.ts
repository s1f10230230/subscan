import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'JPY'): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency,
  }).format(amount)
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function getDateRangeForPeriod(period: string, monthStartDay: number = 1) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  switch (period) {
    case 'week':
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      return { start: startOfWeek, end: endOfWeek }

    case 'month':
      const startOfMonth = new Date(currentYear, currentMonth, monthStartDay)
      const endOfMonth = new Date(currentYear, currentMonth + 1, monthStartDay - 1)
      return { start: startOfMonth, end: endOfMonth }

    case 'quarter':
      const quarterStart = Math.floor(currentMonth / 3) * 3
      const startOfQuarter = new Date(currentYear, quarterStart, 1)
      const endOfQuarter = new Date(currentYear, quarterStart + 3, 0)
      return { start: startOfQuarter, end: endOfQuarter }

    case 'year':
      const startOfYear = new Date(currentYear, 0, 1)
      const endOfYear = new Date(currentYear, 11, 31)
      return { start: startOfYear, end: endOfYear }

    default:
      return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: now }
  }
}

export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}