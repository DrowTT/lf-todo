/**
 * 番茄钟时间相关常量与文案工具。
 * 所有默认值、展示标签和提示文案统一从这里读取。
 */

export const DEFAULT_FOCUS_DURATION_SECONDS = 25 * 60

export function normalizePomodoroDurationSeconds(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 86400
    ? value
    : DEFAULT_FOCUS_DURATION_SECONDS
}

export function formatPomodoroDurationLabel(durationSeconds: number): string {
  const normalized = normalizePomodoroDurationSeconds(durationSeconds)

  if (normalized % 3600 === 0) {
    return `${normalized / 3600} 小时`
  }

  if (normalized % 60 === 0) {
    return `${normalized / 60} 分钟`
  }

  return `${normalized} 秒`
}

export function createPomodoroStartMessage(durationSeconds: number): string {
  return `番茄钟已开始，${formatPomodoroDurationLabel(durationSeconds)}后提醒你休息。`
}

export function createPomodoroCompletionMessage(durationSeconds: number): string {
  return `${formatPomodoroDurationLabel(durationSeconds)}专注已完成，记得休息一下。`
}
