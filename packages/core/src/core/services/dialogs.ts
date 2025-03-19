export interface ChatEvent {
  'dialogs:fetch': {
    chatId: string
  }

  'dialogs:progress': {
    taskId: string
    progress: number
  }

  'dialogs:abort': {
    taskId: string
  }
}
