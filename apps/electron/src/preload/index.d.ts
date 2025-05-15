import type { ElectronAPI } from '@electron-toolkit/preload'
import type { ChannelAPI } from './channel-api'

declare global {
  interface Window {
    electron: ElectronAPI
    channel: ChannelAPI
  }
}
