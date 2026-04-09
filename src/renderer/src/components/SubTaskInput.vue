<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useAutoHeight } from '../composables/useAutoHeight'
import { useAppSessionStore } from '../store/appSession'
import { useSubTaskStore } from '../store/subtask'

const props = defineProps<{
  parentId: number
}>()

const subTaskStore = useSubTaskStore()
const appSessionStore = useAppSessionStore()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const content = ref(appSessionStore.getSubTaskDraft(props.parentId))

const { adjustHeight, resetHeight } = useAutoHeight(textareaRef)
const isSubmitting = computed(() => subTaskStore.isCreatingSubTask(props.parentId))

const handleSubmit = async () => {
  const trimmed = content.value.trim()
  if (!trimmed || isSubmitting.value) return

  const created = await subTaskStore.addSubTask(trimmed, props.parentId)
  if (!created) return

  content.value = ''
  appSessionStore.clearSubTaskDraft(props.parentId)
  nextTick(resetHeight)
  textareaRef.value?.focus()
}

onMounted(() => adjustHeight())

watch(content, (value) => {
  appSessionStore.setSubTaskDraft(props.parentId, value)
})
</script>

<template>
  <div class="sub-add">
    <div class="sub-add__drag-spacer" aria-hidden="true"></div>
    <span class="sub-add__check-placeholder" aria-hidden="true">+</span>
    <textarea
      ref="textareaRef"
      v-model="content"
      rows="1"
      class="sub-add__input"
      placeholder="添加子任务..."
      maxlength="200"
      :disabled="isSubmitting"
      @input="adjustHeight"
      @keydown.enter.exact.prevent="handleSubmit"
      @keyup.escape="($event.target as HTMLTextAreaElement).blur()"
    />
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.sub-add {
  display: flex;
  align-items: flex-start;
  gap: 3px;
  padding: 5px 6px 5px 5px;
}

.sub-add__drag-spacer {
  flex-shrink: 0;
  width: 10px;
  height: 18px;
  margin-top: 1px;
}

.sub-add__check-placeholder {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin-top: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $text-muted;
  font-size: 15px;
  line-height: 1;
  user-select: none;
}

.sub-add__input {
  flex: 1;
  display: block;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  overflow: hidden;
  color: $text-secondary;
  font-size: $font-sm;
  font-family: inherit;
  padding: 0;
  position: relative;
  top: 2px;
  line-height: 1.55;
  transition: color 0.15s ease;

  &::placeholder {
    color: $text-muted;
  }

  &:focus {
    color: $text-primary;
  }

  &:disabled {
    opacity: 0.55;
  }
}
</style>
