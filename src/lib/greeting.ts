export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night'

export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'night'
}

export const GREETING: Record<DayPart, string> = {
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
  night: 'Hi, night owl',
}

/** Read the clock outside render — components call this from a state initializer. */
export function currentDayPart(): DayPart {
  return dayPart(new Date().getHours())
}

/** "Wednesday, 23 September" */
export function todayLabel(): string {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Whole days from `fromISO` to `toISO` (both YYYY-MM-DD). */
export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86_400_000)
}

/** "today" / "tomorrow" / "in 5 days" */
export function dueLabel(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}
