// 等级系统相关 API 封装
import request from './request'

// ─── 响应类型定义 ───

interface DailyInfo {
  checkinDone: boolean
  taskXpCount: number
  totalXpToday: number
}

interface LevelInfo {
  totalXp: number
  currentLevel: number
  levelName: string
  levelColor: string
  currentLevelXp: number
  nextLevelXp: number
  xpProgress: number
  xpNeeded: number
  daily: DailyInfo
}

interface XpGainResult {
  message: string
  xpGain: number
  totalXp: number
  currentLevel: number
  levelName: string
}

// ─── API 函数 ───

/**
 * 每日签到（+5 XP）
 */
export function checkin() {
  return request.post<XpGainResult>('/level/checkin')
}

/**
 * 完成任务获取经验（+3 XP）
 */
export function taskComplete(taskId: string) {
  return request.post<XpGainResult>('/level/task-complete', { taskId })
}

/**
 * 获取等级详情
 */
export function getLevelInfo() {
  return request.get<LevelInfo>('/level/info')
}

export type { LevelInfo, XpGainResult, DailyInfo }
