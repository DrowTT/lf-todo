<script setup lang="ts">
import { useAuthStore } from '../store/auth'

const authStore = useAuthStore()

const emit = defineEmits<{
  upgrade: []
  logout: []
}>()

/**
 * 根据等级返回对应的名称和颜色
 */
function getLevelName(level: number): string {
  if (level <= 5) return '初学者'
  if (level <= 10) return '践行者'
  if (level <= 20) return '专注者'
  if (level <= 35) return '掌控者'
  if (level <= 50) return '征服者'
  return '传奇'
}

function getLevelColor(level: number): string {
  if (level <= 5) return '#B0B0B0'
  if (level <= 10) return '#4CAF50'
  if (level <= 20) return '#2196F3'
  if (level <= 35) return '#9C27B0'
  if (level <= 50) return '#FF9800'
  return '#FF4444'
}
</script>

<template>
  <div class="user-profile">
    <!-- 用户基本信息 -->
    <div class="profile-main">
      <div class="profile-avatar">
        {{ authStore.nickname.charAt(0).toUpperCase() }}
      </div>
      <div class="profile-info">
        <div class="profile-name-row">
          <span class="profile-nickname">{{ authStore.nickname }}</span>
          <!-- Pro 标识 -->
          <span v-if="authStore.isPro" class="pro-tag">PRO</span>
          <!-- 等级标签 -->
          <span
            v-if="authStore.user?.level"
            class="level-tag"
            :style="{ color: getLevelColor(authStore.user.level.currentLevel), borderColor: getLevelColor(authStore.user.level.currentLevel) }"
          >
            Lv.{{ authStore.user.level.currentLevel }}
            {{ getLevelName(authStore.user.level.currentLevel) }}
          </span>
        </div>
        <span class="profile-email">{{ authStore.email }}</span>
      </div>
    </div>

    <!-- 操作区 -->
    <div class="profile-actions">
      <button
        v-if="!authStore.isPro"
        class="action-btn action-btn--upgrade"
        @click="emit('upgrade')"
      >
        ✨ 升级 Pro
      </button>
      <button class="action-btn action-btn--logout" @click="emit('logout')">
        退出登录
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.user-profile {
  padding: $spacing-lg;
  border-bottom: 1px solid $border-color;
}

.profile-main {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  margin-bottom: $spacing-md;
}

.profile-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, $accent-color, #6366f1);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-xl;
  font-weight: 700;
  flex-shrink: 0;
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.profile-name-row {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  flex-wrap: wrap;
}

.profile-nickname {
  font-size: $font-lg;
  font-weight: 600;
  color: $text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pro-tag {
  display: inline-block;
  padding: 0 6px;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  color: white;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  border-radius: 3px;
  line-height: 18px;
}

.level-tag {
  display: inline-block;
  padding: 0 6px;
  font-size: 10px;
  font-weight: 600;
  border: 1px solid;
  border-radius: 3px;
  line-height: 16px;
}

.profile-email {
  font-size: $font-sm;
  color: $text-muted;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// ─── 操作按钮 ───
.profile-actions {
  display: flex;
  gap: $spacing-sm;
}

.action-btn {
  flex: 1;
  height: 32px;
  border: none;
  border-radius: $radius-md;
  font-size: $font-sm;
  font-weight: 500;
  cursor: pointer;
  transition: all $transition-fast;

  &--upgrade {
    background: linear-gradient(135deg, #f59e0b, #f97316);
    color: white;

    &:hover {
      box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
    }
  }

  &--logout {
    background: rgba(0, 0, 0, 0.04);
    color: $text-secondary;
    border: 1px solid $border-color;

    &:hover {
      background: rgba(0, 0, 0, 0.08);
      color: $danger-color;
      border-color: rgba($danger-color, 0.3);
    }
  }
}
</style>
