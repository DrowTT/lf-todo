import type { AutoCleanupConfig } from '../types/models'
import { expectBoolean } from './utils'
import { parseAutoCleanupConfig } from './entities'

export function parseBooleanSetting(value: unknown, label = 'enabled'): boolean {
  return expectBoolean(value, label)
}

export function parseSetAutoCleanupRequest(value: unknown, label = 'payload'): AutoCleanupConfig {
  return parseAutoCleanupConfig(value, label)
}
