export interface Action {
  icon: string
  onClick: () => void
  name?: string
  confirm?: boolean
  confirmText?: string
}
