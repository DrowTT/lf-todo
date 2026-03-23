<script setup lang="ts">
import { ref } from 'vue'
import { Task } from '../db'
import { store } from '../store'
import { useConfirm } from '../composables/useConfirm'
import { useInlineEdit } from '../composables/useInlineEdit'
import { Check, X } from 'lucide-vue-next'

const { confirm } = useConfirm()

const props = defineProps<{
  task: Task
  parentId: number
}>()

const handleToggle = () => store.toggleSubTask(props.task.id, props.parentId)

const handleDelete = async () => {
  const ok = await confirm('确认删除该子任务吗？')
  if (ok) store.deleteSubTask(props.task.id, props.parentId)
}

const editInputRef = ref<HTMLTextAreaElement | null>(null)
const { isEditing, editContent, adjustHeight, handleDblClick, saveEdit, cancelEdit, onBlur } =
  useInlineEdit(
    editInputRef,
    () => props.task.content,
    (content) => store.updateSubTaskContent(props.task.id, props.parentId, content)
  )
</script>

<template>
  <div class="sub" :class="{ 'sub--done': task.is_completed }">
    <!-- 勾选框 -->
    <button class="sub__check" :class="{ 'sub__check--on': task.is_completed }" @click="handleToggle">
      <Check v-if="task.is_completed" class="sub__check-svg" :size="9" />
    </button>

    <!-- 内容 / 编辑 -->
    <div v-if="isEditing" class="sub__edit-wrap">
      <textarea
        ref="editInputRef"
        v-model="editContent"
        class="sub__edit-area"
        maxlength="200"
        rows="1"
        @keydown.enter.exact.prevent="saveEdit"
        @keyup.escape="cancelEdit"
        @blur="onBlur"
        @input="adjustHeight"
      />
    </div>
    <div v-else class="sub__text" @dblclick="handleDblClick">{{ task.content }}</div>

    <!-- 删除 -->
    <button v-if="!isEditing" class="sub__del" @click="handleDelete">
      <X :size="11" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.sub {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 6px;
  transition: background-color 0.15s ease;

  &:hover {
    background: rgba(37, 99, 235, 0.04);

    .sub__del { opacity: 1; }
  }

  &--done {
    .sub__text {
      color: #94A3B8;
      text-decoration: line-through;
      text-decoration-color: rgba(148, 163, 184, 0.3);
    }

    .sub__check {
      background: #94A3B8;
      border-color: #94A3B8;

      &:hover {
        background: #64748B;
        border-color: #64748B;
      }
    }

    .sub__check-svg { color: #fff; }
  }
}

// ─── 勾选框（小号） ───────────────────────
.sub__check {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin-top: 2px;
  border: 1.5px solid #CBD5E1;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  transition: all 0.15s ease;
  padding: 0;

  &:hover {
    border-color: #2563EB;
  }

  &--on {
    background: #94A3B8;
    border-color: #94A3B8;
  }
}

.sub__check-svg {
  color: #fff;
}

// ─── 文本 ──────────────────────────────────
.sub__text {
  flex: 1;
  font-size: 12px;
  color: #475569;
  line-height: 1.55;
  word-break: break-word;
  user-select: text;
  cursor: text;
}

// ─── 编辑 ──────────────────────────────────
.sub__edit-wrap {
  flex: 1;
}

.sub__edit-area {
  width: 100%;
  background: #fff;
  color: #0F172A;
  font-size: 12px;
  line-height: 1.55;
  padding: 2px 8px;
  border: 1.5px solid #2563EB;
  border-radius: 6px;
  outline: none;
  box-sizing: border-box;
  resize: none;
  overflow: hidden;
  font-family: inherit;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

// ─── 删除 ──────────────────────────────────
.sub__del {
  flex-shrink: 0;
  opacity: 0;
  padding: 2px;
  background: transparent;
  border: none;
  color: #94A3B8;
  cursor: pointer;
  transition: all 0.15s ease;
  border-radius: 4px;

  &:hover {
    color: #DC2626;
    background: rgba(220, 38, 38, 0.08);
  }
}
</style>
