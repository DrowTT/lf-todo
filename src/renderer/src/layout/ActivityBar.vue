<script setup lang="ts">
import { computed } from 'vue'
import { CheckSquare, Clock3, Settings } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useAppSessionStore } from '../store/appSession'
import { usePomodoroStore } from '../store/pomodoro'

const appSessionStore = useAppSessionStore()
const pomodoroStore = usePomodoroStore()
const { isRunning: isPomodoroRunning } = storeToRefs(pomodoroStore)

const currentView = computed(() => appSessionStore.currentMainView)

/** 切换到待办视图 */
const switchToTasks = () => {
  appSessionStore.setCurrentMainView('tasks')
}

/** 切换到番茄钟视图 */
const switchToPomodoro = () => {
  appSessionStore.setCurrentMainView('pomodoro')
}

/** 切换到设置视图 */
const switchToSettings = () => {
  appSessionStore.setCurrentMainView('settings')
}
</script>

<template>
  <div class="activity-bar">
    <!-- 上方：功能模块入口 -->
    <div class="activity-bar__top">
      <!-- 待办模块 -->
      <button
        class="activity-bar__item"
        :class="{ 'activity-bar__item--active': currentView === 'tasks' }"
        title="待办"
        @click="switchToTasks"
      >
        <span class="activity-bar__indicator" />
        <CheckSquare :size="20" :stroke-width="1.8" />
      </button>

      <!-- 番茄钟模块 -->
      <button
        class="activity-bar__item"
        :class="{ 'activity-bar__item--active': currentView === 'pomodoro' }"
        title="番茄钟"
        @click="switchToPomodoro"
      >
        <span class="activity-bar__indicator" />
        <Clock3 :size="20" :stroke-width="1.8" />
        <!-- 番茄钟运行时的脉冲指示点 -->
        <span v-if="isPomodoroRunning" class="activity-bar__pulse-dot" />
      </button>
    </div>

    <!-- 下方：设置 -->
    <div class="activity-bar__bottom">
      <button
        class="activity-bar__item"
        :class="{ 'activity-bar__item--active': currentView === 'settings' }"
        title="设置"
        @click="switchToSettings"
      >
        <span class="activity-bar__indicator" />
        <Settings :size="20" :stroke-width="1.8" />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.activity-bar {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 48px;
  height: 100%;
  flex-shrink: 0;
  background: linear-gradient(180deg, #dce3ed 0%, #d5dce8 100%);
  border-right: 1px solid rgba(15, 23, 42, 0.08);
  user-select: none;

  &__top,
  &__bottom {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 0;
    gap: 2px;
  }

  &__item {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 12px;
    background: transparent;
    color: $text-muted;
    cursor: pointer;
    transition:
      color $transition-normal,
      background-color $transition-normal;

    &:hover {
      color: $text-secondary;
      background: rgba(255, 255, 255, 0.5);
    }

    /* 激活态 */
    &--active {
      color: $accent-color;
      background: rgba(255, 255, 255, 0.65);

      &:hover {
        color: $accent-color;
        background: rgba(255, 255, 255, 0.75);
      }

      /* 激活指示条 */
      .activity-bar__indicator {
        opacity: 1;
        transform: scaleY(1);
      }
    }
  }

  /* 左侧竖条指示器 */
  &__indicator {
    position: absolute;
    left: -4px;
    top: 50%;
    width: 3px;
    height: 18px;
    margin-top: -9px;
    border-radius: 0 3px 3px 0;
    background: $accent-color;
    opacity: 0;
    transform: scaleY(0);
    transition:
      opacity $transition-normal,
      transform $transition-spring;
  }

  /* 番茄钟运行脉冲指示点 */
  &__pulse-dot {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: $success-color;
    animation: ab-pulse 1.8s ease-in-out infinite;
    box-shadow: 0 0 0 0 rgba($success-color, 0.4);
  }
}

@keyframes ab-pulse {
  0%,
  100% {
    opacity: 0.5;
    box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.4);
  }
  50% {
    opacity: 1;
    box-shadow: 0 0 0 4px rgba(22, 163, 74, 0);
  }
}
</style>
