import { ref, nextTick, type Ref } from 'vue'
import { useAutoHeight } from './useAutoHeight'

/**
 * 内联编辑 composable
 * 封装"双击进入编辑 / 回车保存 / Escape 取消 / blur 智能保存"的完整逻辑。
 * 同时集成 useAutoHeight，textarea 高度自动跟随内容。
 *
 * @param inputRef    由调用方持有的 textarea ref（template 的 ref="..." 绑定需在同一 scope）
 * @param getContent  获取当前原始内容的函数（通常返回 props.task.content）
 * @param onSave      内容变化时的保存回调
 */
export function useInlineEdit(
  inputRef: Ref<HTMLTextAreaElement | null>,
  getContent: () => string,
  onSave: (content: string) => void
) {
  const isEditing = ref(false)
  const editContent = ref('')
  const { adjustHeight } = useAutoHeight(inputRef)

  // 双击进入编辑模式
  const handleDblClick = () => {
    isEditing.value = true
    editContent.value = getContent()
    nextTick(() => {
      adjustHeight()
      inputRef.value?.focus()
      inputRef.value?.select()
    })
  }

  // 取消编辑，还原内容
  const cancelEdit = () => {
    isEditing.value = false
    editContent.value = getContent()
  }

  // 保存编辑（有变化才触发 onSave）
  const saveEdit = () => {
    const trimmed = editContent.value.trim()
    if (trimmed && trimmed !== getContent()) {
      onSave(trimmed)
    }
    isEditing.value = false
  }

  // blur 时：内容未变化则直接取消，否则保存（不触发多余 IPC）
  const onBlur = () => {
    const trimmed = editContent.value.trim()
    if (!trimmed || trimmed === getContent()) {
      cancelEdit()
    } else {
      saveEdit()
    }
  }

  return {
    isEditing,
    editContent,
    adjustHeight,
    handleDblClick,
    saveEdit,
    cancelEdit,
    onBlur
  }
}
