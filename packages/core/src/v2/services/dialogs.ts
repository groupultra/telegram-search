export interface DialogEvent {
  'dialogs:fetch': (data: { chatId: string }) => void

  'dialogs:progress': (data: { taskId: string, progress: number }) => void

  'dialogs:abort': (data: { taskId: string }) => void
}
