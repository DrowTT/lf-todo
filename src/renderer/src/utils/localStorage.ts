export function readStoredNumber(key: string): number | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null

  const parsed = Number.parseInt(raw, 10)
  return Number.isNaN(parsed) ? null : parsed
}

export function writeStoredNumber(key: string, value: number): void {
  localStorage.setItem(key, String(value))
}

export function clearStoredValue(key: string): void {
  localStorage.removeItem(key)
}

export function readStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeStoredJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}
