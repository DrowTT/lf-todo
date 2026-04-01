import { readonly, ref } from 'vue'

export interface PendingOperation {
  type: string
  entityId: number | string | null
  startedAt: number
}

interface PendingOperationQuery {
  key?: string
  type?: string | string[]
  entityId?: number | string | null
}

interface RunAsyncActionOptions<T> {
  key: string
  type: string
  entityId?: number | string | null
  before?: () => void
  execute: () => Promise<T>
  onSuccess?: (result: T) => void
  rollback?: () => void
  onError?: (error: unknown) => Promise<void> | void
  errorMessage?: string
  notifyError?: (message: string) => void
  logPrefix?: string
}

const pendingOperationsState = ref<Record<string, PendingOperation>>({})

export const pendingOperations = readonly(pendingOperationsState)

export function buildPendingOperationKey(type: string, entityId?: number | string | null) {
  return `${type}:${entityId ?? 'global'}`
}

export function hasPendingOperation(query: PendingOperationQuery) {
  if (query.key) {
    return Boolean(pendingOperationsState.value[query.key])
  }

  const types = query.type ? (Array.isArray(query.type) ? query.type : [query.type]) : null

  return Object.values(pendingOperationsState.value).some((operation) => {
    if (types && !types.includes(operation.type)) {
      return false
    }

    if (query.entityId !== undefined && operation.entityId !== query.entityId) {
      return false
    }

    return true
  })
}

function setPendingOperation(key: string, type: string, entityId?: number | string | null) {
  pendingOperationsState.value[key] = {
    type,
    entityId: entityId ?? null,
    startedAt: Date.now()
  }
}

function clearPendingOperation(key: string) {
  delete pendingOperationsState.value[key]
}

export async function runAsyncAction<T>(options: RunAsyncActionOptions<T>) {
  if (hasPendingOperation({ key: options.key })) {
    return false
  }

  setPendingOperation(options.key, options.type, options.entityId)

  try {
    options.before?.()
    const result = await options.execute()
    options.onSuccess?.(result)
    return true
  } catch (error) {
    options.rollback?.()
    await options.onError?.(error)

    console.error(options.logPrefix ?? `[runAsyncAction] ${options.type} failed`, error)

    if (options.errorMessage) {
      options.notifyError?.(options.errorMessage)
    }

    return false
  } finally {
    clearPendingOperation(options.key)
  }
}
