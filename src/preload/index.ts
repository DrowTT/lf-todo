import { contextBridge, ipcRenderer } from 'electron'
import type {
  QuickAddCommittedEvent,
  QuickAddSubmitInput,
  TaskCreateInput,
  TaskUpdate
} from '../shared/types/models'
import {
  parseAppInfo,
  parseArchivedTaskGroups,
  parseAutoCleanupConfig,
  parseCategories,
  parseCategory,
  parsePendingTaskCounts,
  parsePomodoroData,
  parsePomodoroSessionState,
  parseQuickAddCommittedEvent,
  parseQuickAddSubmitResult,
  parseSettingsData,
  parseTask,
  parseTasks,
  parseUpdateStatusData
} from '../shared/contracts/entities'
import {
  parseArchiveTaskRequest,
  parseCreateSubTaskRequest,
  parseCreateTaskRequest,
  parseQuickAddSubmitRequest,
  parseReorderTasksRequest,
  parseRestoreArchivedTasksRequest,
  parseSearchTasksRequest,
  parseSetTaskCompletedRequest,
  parseUpdateTaskRequest
} from '../shared/contracts/db'
import {
  parseBooleanSetting,
  parseNotifyPomodoroCompletedRequest,
  parseSetAutoCleanupRequest,
  parseSetPomodoroFocusDurationRequest,
  parseSetPomodoroActiveSessionRequest
} from '../shared/contracts/settings'
import { expectBoolean, expectInteger, expectString, parseVoid } from '../shared/contracts/utils'

function invokeWithResponse<T>(
  channel: string,
  parser: (value: unknown, label: string) => T
): Promise<T> {
  return ipcRenderer.invoke(channel).then((value) => parser(value, `${channel}.response`))
}

function invokeWithPayload<Payload, Response>(
  channel: string,
  payload: unknown,
  payloadParser: (value: unknown, label: string) => Payload,
  responseParser: (value: unknown, label: string) => Response
): Promise<Response> {
  const parsedPayload = payloadParser(payload, `${channel}.request`)

  return ipcRenderer.invoke(channel, parsedPayload).then((value) => {
    return responseParser(value, `${channel}.response`)
  })
}

function invokeVoidWithPayload<Payload>(
  channel: string,
  payload: unknown,
  payloadParser: (value: unknown, label: string) => Payload
): Promise<void> {
  const parsedPayload = payloadParser(payload, `${channel}.request`)

  return ipcRenderer.invoke(channel, parsedPayload).then((value) => {
    return parseVoid(value, `${channel}.response`)
  })
}

function subscribe<T>(
  channel: string,
  callback: (value: T) => void,
  parser: (value: unknown, label: string) => T
): () => void {
  const listener = (_event: unknown, value: unknown): void => {
    callback(parser(value, `${channel}.event`))
  }

  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.off(channel, listener)
}

const api = {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    close: () => ipcRenderer.send('window:close'),
    hideToTray: () => ipcRenderer.send('window:hide-to-tray'),
    quit: () => ipcRenderer.send('window:quit'),
    toggleAlwaysOnTop: () => ipcRenderer.send('window:toggle-always-on-top'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    resizeQuickAddWindow: (height: number) =>
      ipcRenderer.send(
        'window:resize-quick-add',
        expectInteger(height, 'window:resize-quick-add.request.height', {
          min: 140,
          max: 420
        })
      ),
    onQuitRequested: (callback: () => void) =>
      subscribe('window:quit-requested', callback, parseVoid),
    onFocusMainInputRequested: (callback: () => void) =>
      subscribe('window:focus-main-input', callback, parseVoid),
    onFocusQuickAddInputRequested: (callback: () => void) =>
      subscribe('window:focus-quick-add-input', callback, parseVoid),
    onQuickAddSessionRequested: (callback: () => void) =>
      subscribe('window:quick-add-session-requested', callback, parseVoid),
    onQuickAddCommitted: (callback: (payload: QuickAddCommittedEvent) => void) =>
      subscribe('window:quick-add-committed', callback, parseQuickAddCommittedEvent),
    onAlwaysOnTopChanged: (callback: (flag: boolean) => void) =>
      subscribe('window:always-on-top-changed', callback, expectBoolean),
    onMaximizedChanged: (callback: (flag: boolean) => void) =>
      subscribe('window:maximized-changed', callback, expectBoolean)
  },
  db: {
    getCategories: () => invokeWithResponse('db:get-categories', parseCategories),
    createCategory: (name: string) => {
      const parsedName = expectString(name, 'db:create-category.request.name', {
        trim: true,
        minLength: 1,
        maxLength: 64
      })

      return ipcRenderer.invoke('db:create-category', parsedName).then((value) => {
        return parseCategory(value, 'db:create-category.response')
      })
    },
    updateCategory: (id: number, name: string) => {
      const parsedId = expectInteger(id, 'db:update-category.request.id', { min: 1 })
      const parsedName = expectString(name, 'db:update-category.request.name', {
        trim: true,
        minLength: 1,
        maxLength: 64
      })

      return ipcRenderer.invoke('db:update-category', parsedId, parsedName).then((value) => {
        return parseVoid(value, 'db:update-category.response')
      })
    },
    deleteCategory: (id: number) =>
      ipcRenderer
        .invoke(
          'db:delete-category',
          expectInteger(id, 'db:delete-category.request.id', { min: 1 })
        )
        .then((value) => parseVoid(value, 'db:delete-category.response')),
    getTasks: (categoryId: number) =>
      ipcRenderer
        .invoke(
          'db:get-tasks',
          expectInteger(categoryId, 'db:get-tasks.request.categoryId', { min: 1 })
        )
        .then((value) => parseTasks(value, 'db:get-tasks.response')),
    getArchivedTaskGroups: () =>
      ipcRenderer
        .invoke('db:get-archived-task-groups')
        .then((value) => parseArchivedTaskGroups(value, 'db:get-archived-task-groups.response')),
    searchTasks: (input: { query: string; categoryId?: number | null; limit?: number }) =>
      invokeWithPayload(
        'db:search-tasks',
        {
          query: input.query,
          categoryId: input.categoryId ?? null,
          limit: input.limit
        },
        parseSearchTasksRequest,
        parseTasks
      ),
    createTask: (input: TaskCreateInput) =>
      invokeWithPayload('db:create-task', input, parseCreateTaskRequest, parseTask),
    updateTask: (id: number, updates: TaskUpdate) =>
      invokeVoidWithPayload('db:update-task', { id, updates }, parseUpdateTaskRequest),
    deleteTask: (id: number) =>
      ipcRenderer
        .invoke('db:delete-task', expectInteger(id, 'db:delete-task.request.id', { min: 1 }))
        .then((value) => parseVoid(value, 'db:delete-task.response')),
    toggleTaskComplete: (id: number) =>
      ipcRenderer
        .invoke('db:toggle-task', expectInteger(id, 'db:toggle-task.request.id', { min: 1 }))
        .then((value) => parseVoid(value, 'db:toggle-task.response')),
    setTaskCompleted: (id: number, completed: boolean) =>
      invokeVoidWithPayload(
        'db:set-task-completed',
        { id, completed },
        parseSetTaskCompletedRequest
      ),
    getPendingTaskCounts: () => invokeWithResponse('db:get-pending-counts', parsePendingTaskCounts),
    archiveCompletedTasks: (categoryId: number) =>
      ipcRenderer
        .invoke(
          'db:archive-completed-tasks',
          expectInteger(categoryId, 'db:archive-completed-tasks.request.categoryId', { min: 1 })
        )
        .then((value) => expectInteger(value, 'db:archive-completed-tasks.response', { min: 0 })),
    archiveTask: (id: number) =>
      invokeVoidWithPayload('db:archive-task', { id }, parseArchiveTaskRequest),
    restoreArchivedTasks: (ids: number[]) =>
      invokeWithPayload(
        'db:restore-archived-tasks',
        { ids },
        parseRestoreArchivedTasksRequest,
        (value, label) => expectInteger(value, label, { min: 0 })
      ),
    reorderTasks: (orderedIds: number[]) =>
      invokeVoidWithPayload('db:reorder-tasks', { orderedIds }, parseReorderTasksRequest),
    reorderSubTasks: (orderedIds: number[]) =>
      invokeVoidWithPayload('db:reorder-subtasks', { orderedIds }, parseReorderTasksRequest),
    getSubTasks: (parentId: number) =>
      ipcRenderer
        .invoke(
          'db:get-subtasks',
          expectInteger(parentId, 'db:get-subtasks.request.parentId', { min: 1 })
        )
        .then((value) => parseTasks(value, 'db:get-subtasks.response')),
    createSubTask: (content: string, parentId: number) =>
      invokeWithPayload(
        'db:create-subtask',
        { content, parentId },
        parseCreateSubTaskRequest,
        parseTask
      ),
    batchCompleteSubTasks: (parentId: number) =>
      ipcRenderer
        .invoke(
          'db:batch-complete-subtasks',
          expectInteger(parentId, 'db:batch-complete-subtasks.request.parentId', { min: 1 })
        )
        .then((value) => expectInteger(value, 'db:batch-complete-subtasks.response', { min: 0 }))
  },
  settings: {
    getAll: () => invokeWithResponse('settings:get-all', parseSettingsData),
    setAutoLaunch: (enabled: boolean) =>
      ipcRenderer
        .invoke(
          'settings:set-auto-launch',
          parseBooleanSetting(enabled, 'settings:set-auto-launch.request')
        )
        .then((value) => expectBoolean(value, 'settings:set-auto-launch.response')),
    setCloseToTray: (enabled: boolean) =>
      ipcRenderer
        .invoke(
          'settings:set-close-to-tray',
          parseBooleanSetting(enabled, 'settings:set-close-to-tray.request')
        )
        .then((value) => expectBoolean(value, 'settings:set-close-to-tray.response')),
    setAutoCleanup: (config: { enabled: boolean; days: number }) =>
      invokeWithPayload(
        'settings:set-auto-cleanup',
        config,
        parseSetAutoCleanupRequest,
        parseAutoCleanupConfig
      ),
    setPomodoroFocusDuration: (durationSeconds: unknown) =>
      ipcRenderer
        .invoke(
          'settings:set-pomodoro-focus-duration',
          parseSetPomodoroFocusDurationRequest(
            durationSeconds,
            'settings:set-pomodoro-focus-duration.request'
          )
        )
        .then((value) =>
          expectInteger(value, 'settings:set-pomodoro-focus-duration.response', {
            min: 1,
            max: 86400
          })
        ),
    setPomodoroActiveSession: (session: unknown) =>
      ipcRenderer
        .invoke(
          'settings:set-pomodoro-active-session',
          parseSetPomodoroActiveSessionRequest(
            session,
            'settings:set-pomodoro-active-session.request'
          )
        )
        .then((value) =>
          value === null
            ? null
            : parsePomodoroSessionState(value, 'settings:set-pomodoro-active-session.response')
        ),
    completePomodoroSession: (session: unknown) =>
      invokeWithPayload(
        'settings:complete-pomodoro-session',
        session,
        parseSetPomodoroActiveSessionRequest,
        parsePomodoroData
      ),
    setGlobalHotkeys: (config: unknown) =>
      ipcRenderer.invoke('settings:set-global-hotkeys', config).then((value) => {
        return parseVoid(value, 'settings:set-global-hotkeys.response')
      }),
    notifyPomodoroCompleted: (durationSeconds: unknown) =>
      ipcRenderer
        .invoke(
          'settings:notify-pomodoro-completed',
          parseNotifyPomodoroCompletedRequest(
            durationSeconds,
            'settings:notify-pomodoro-completed.request'
          )
        )
        .then((value) => parseVoid(value, 'settings:notify-pomodoro-completed.response')),
    exportData: () =>
      ipcRenderer
        .invoke('settings:export-data')
        .then((value) => expectBoolean(value, 'settings:export-data.response')),
    getAppInfo: () => invokeWithResponse('settings:get-app-info', parseAppInfo)
  },
  quickAdd: {
    submit: (input: QuickAddSubmitInput) =>
      invokeWithPayload(
        'quick-add:submit',
        input,
        parseQuickAddSubmitRequest,
        parseQuickAddSubmitResult
      )
  },
  updater: {
    checkForUpdates: () =>
      ipcRenderer
        .invoke('updater:check')
        .then((value) => parseVoid(value, 'updater:check.response')),
    downloadUpdate: () =>
      ipcRenderer
        .invoke('updater:download')
        .then((value) => parseVoid(value, 'updater:download.response')),
    installUpdate: () =>
      ipcRenderer
        .invoke('updater:install')
        .then((value) => parseVoid(value, 'updater:install.response')),
    onUpdateStatus: (callback: (data: Record<string, unknown>) => void) =>
      subscribe('updater:status', callback, parseUpdateStatusData)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
