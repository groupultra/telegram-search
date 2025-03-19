export interface MessageEvent {
  'message:fetch': {
    chatId: string
  }

  'message:takeout': {
    chatId: string
  }

  'message:progress': {
    taskId: string
    progress: number
  }

  'message:abort': {
    taskId: string
  }
}
