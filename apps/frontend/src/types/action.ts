import type { Ref } from 'vue'

export interface Action {
  icon: string
  onClick: () => void
  name?: string
  confirm?: boolean
  confirmText?: string
  disabled?: boolean | Ref<boolean>

}
