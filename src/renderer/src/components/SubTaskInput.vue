<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { store } from '../store'
import { useAutoHeight } from '../composables/useAutoHeight'

const props = defineProps<{
  parentId: number
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const content = ref('')

// 提交子任务
const handleSubmit = async () => {
  const trimmed = content.value.trim()
  if (!trimmed) return
  await store.addSubTask(trimmed, props.parentId)
  content.value = ''
  nextTick(resetHeight)
  textareaRef.value?.focus()
}

const { adjustHeight, resetHeight } = useAutoHeight(textareaRef)

// 挂载时同步初始化高度
onMounted(() => adjustHeight())
</script>

<template>
  <div class="sub-add">
    <span class="sub-add__icon">+</span>
    <textarea
      ref="textareaRef"
      v-model="content"
      rows="1"
      class="sub-add__input"
      placeholder="添加子任务…"
      maxlength="200"
      @input="adjustHeight"
      @keydown.enter.exact.prevent="handleSubmit"
    />
  </div>
</template>

<style scoped lang="scss">
.sub-add {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
}

.sub-add__icon {
  flex-shrink: 0;
  font-size: 14px;
  color: #94A3B8;
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
  color: #475569;
  font-size: 12px;
  font-family: inherit;
  padding: 0;
  line-height: 1.55;
  transition: color 0.15s ease;

  &::placeholder { color: #94A3B8; }
  &:focus { color: #0F172A; }
}
</style>
