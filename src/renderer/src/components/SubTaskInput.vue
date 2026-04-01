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
    <span class="sub-add__icon">+</span>
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
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
}

.sub-add__icon {
  flex-shrink: 0;
  font-size: $font-lg;
  color: $text-muted;
  line-height: 1;
  user-select: none;
  width: 16px;
  text-align: center;
}

.sub-add__input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  overflow: hidden;
  color: $text-secondary;
  font-size: $font-sm;
  font-family: inherit;
  padding: 0;
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
