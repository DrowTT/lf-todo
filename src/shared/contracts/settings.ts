import type { AutoCleanupConfig, PomodoroSessionState } from '../types/models'
import { expectBoolean, expectInteger } from './utils'
import { parseAutoCleanupConfig, parsePomodoroSessionState } from './entities'
import { normalizePomodoroDurationSeconds } from '../constants/pomodoro'

export function parseBooleanSetting(value: unknown, label = 'enabled'): boolean {
  return expectBoolean(value, label)
}

export function parseSetAutoCleanupRequest(value: unknown, label = 'payload'): AutoCleanupConfig {
  return parseAutoCleanupConfig(value, label)
}

export function parseSetPomodoroActiveSessionRequest(
  value: unknown,
  label = 'payload'
): PomodoroSessionState | null {
  if (value === null) return null
  return parsePomodoroSessionState(value, label)
}

export function parseNotifyPomodoroCompletedRequest(value: unknown, label = 'payload'): number {
  return normalizePomodoroDurationSeconds(expectInteger(value, label, { min: 1, max: 86400 }))
}

export function parseSetPomodoroFocusDurationRequest(value: unknown, label = 'payload'): number {
  return normalizePomodoroDurationSeconds(expectInteger(value, label, { min: 1, max: 86400 }))
}
