import type { ClientRegisterEventHandler } from '.'

import { useSyncTaskStore } from '../store/useSyncTask'

export function registerTakeoutEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler('takeout:task:progress', (data) => {
    useSyncTaskStore().currentTask = data
  })
  
  registerEventHandler('core:error', (data) => {
    const error = data.error as any
    const syncTaskStore = useSyncTaskStore()
    
    // 检查是否是 takeout 延迟错误
    if (error && typeof error === 'string' && error.includes('TAKEOUT_INIT_DELAY')) {
      // 从错误中提取延迟时间
      const delayMatch = error.match(/TAKEOUT_INIT_DELAY_(\d+)/)
      const delaySeconds = delayMatch ? parseInt(delayMatch[1]) : 86400
      const delayHours = Math.ceil(delaySeconds / 3600)
      
      // 更新同步任务状态
      syncTaskStore.setError(`Telegram 限制同步操作，需要等待 ${delayHours} 小时后再试`)
    }
  })
}
