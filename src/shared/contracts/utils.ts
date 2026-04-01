export class ContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContractError'
  }
}

interface IntegerOptions {
  min?: number
  max?: number
}

interface StringOptions {
  minLength?: number
  maxLength?: number
  trim?: boolean
}

export function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContractError(`${label} must be an object`)
  }

  return value as Record<string, unknown>
}

export function assertAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string
): void {
  const allowedKeySet = new Set(allowedKeys)

  for (const key of Object.keys(value)) {
    if (!allowedKeySet.has(key)) {
      throw new ContractError(`${label} contains unsupported key "${key}"`)
    }
  }
}

export function expectString(value: unknown, label: string, options: StringOptions = {}): string {
  if (typeof value !== 'string') {
    throw new ContractError(`${label} must be a string`)
  }

  const result = options.trim ? value.trim() : value

  if (options.minLength !== undefined && result.length < options.minLength) {
    throw new ContractError(`${label} must be at least ${options.minLength} characters`)
  }

  if (options.maxLength !== undefined && result.length > options.maxLength) {
    throw new ContractError(`${label} must be at most ${options.maxLength} characters`)
  }

  return result
}

export function expectBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ContractError(`${label} must be a boolean`)
  }

  return value
}

export function expectInteger(value: unknown, label: string, options: IntegerOptions = {}): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ContractError(`${label} must be an integer`)
  }

  if (options.min !== undefined && value < options.min) {
    throw new ContractError(`${label} must be >= ${options.min}`)
  }

  if (options.max !== undefined && value > options.max) {
    throw new ContractError(`${label} must be <= ${options.max}`)
  }

  return value
}

export function expectArray<T>(
  value: unknown,
  label: string,
  itemParser: (item: unknown, itemLabel: string) => T
): T[] {
  if (!Array.isArray(value)) {
    throw new ContractError(`${label} must be an array`)
  }

  return value.map((item, index) => itemParser(item, `${label}[${index}]`))
}

export function expectUndefined(value: unknown, label: string): void {
  if (value !== undefined) {
    throw new ContractError(`${label} must be empty`)
  }
}

export function parseVoid(value: unknown, label = 'payload'): void {
  expectUndefined(value, label)
}
