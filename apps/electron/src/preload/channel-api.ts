import type { WsMessageToClient, WsMessageToServer } from '../main/ws-event'

import { ipcRenderer } from 'electron/renderer'

export const channelAPI = {
  open: () => {
    ipcRenderer.send('channel:open')
  },
  message: (event: WsMessageToServer) => {
    ipcRenderer.send('channel:message', event)
  },
  onMessage: (callback: (event: WsMessageToClient) => void) => {
    ipcRenderer.on('channel:message', (_, event: WsMessageToClient) => {
      callback(event)
    })
  },
}

export type ChannelAPI = typeof channelAPI
