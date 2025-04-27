export interface Action {
  icon: string
  onClick: () => void
  confirm?: boolean
  confirmText?: string
}
