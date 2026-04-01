import { expectUndefined } from './utils'

export function parseNoPayloadRequest(value: unknown, label = 'payload'): void {
  expectUndefined(value, label)
}
