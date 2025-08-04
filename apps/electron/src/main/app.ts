import type { CoreContext, CoreEventData, FromCoreEvent, ToCoreEvent } from '@tg-search/core'
import type { BrowserWindow } from 'electron/main'

import type { WsEventToClientData, WsMessageToClient, WsMessageToServer } from './ws-event'

import process from 'node:process'

import { parseEnvFlags } from '@tg-search/common'
import { initConfig } from '@tg-search/common/node'
import { createCoreInstance } from '@tg-search/core'
import { initDrizzle } from '@tg-search/db'
import { initLogger, useLogger } from '@unbird/logg'
import { ipcMain } from 'electron/main'

import { createWsMessage } from './ws-event'

export interface ClientState {
  ctx?: CoreContext

  isConnected: boolean
  phoneNumber?: string
}

async function initCore(): Promise<ReturnType<typeof useLogger>> {
  parseEnvFlags(process.env as Record<string, string>)
  initLogger()
  const logger = useLogger()
  await initConfig()

  try {
    await initDrizzle(logger)
    logger.log('Database initialized successfully')
  }
  catch (error) {
    logger.withError(error).error('Failed to initialize services')
    process.exit(1)
  }

  return logger
}

function setupErrorHandlers(logger: ReturnType<typeof useLogger>): void {
  // TODO: fix type
  const handleError = (error: any, type: string) => {
    logger.withFields({ cause: String(error?.cause), cause_json: JSON.stringify(error?.cause) }).withError(error).error(type)
  }

  process.on('uncaughtException', error => handleError(error, 'Uncaught exception'))
  process.on('unhandledRejection', error => handleError(error, 'Unhandled rejection'))
}

export async function bootstrap() {
  const logger = await initCore()
  setupErrorHandlers(logger)
}

export function setupElectronIpc(browserWindow: BrowserWindow) {
  const logger = useLogger('server:ws')
  const sessionId = 'electron' // pseudo session id
  const state: ClientState = {
    ctx: createCoreInstance(),
    isConnected: false,
  }

  function sendMessage(event: WsMessageToClient) {
    browserWindow.webContents.send('channel:message', event)
  }

  ipcMain.on('channel:open', () => {
    logger.log('IPC connection opened')

    sendMessage(createWsMessage('server:connected', { sessionId, connected: state.isConnected }))
  })

  ipcMain.on('channel:message', (_, event: WsMessageToServer) => {
    try {
      if (event.type === 'server:event:register') {
        if (!event.data.event.startsWith('server:')) {
          const eventName = event.data.event as keyof FromCoreEvent

          const fn = (data: WsEventToClientData<keyof FromCoreEvent>) => {
            logger.withFields({ eventName }).log('Sending event to client')
            sendMessage(createWsMessage(eventName, data))
          }

          state.ctx?.emitter.on(eventName, (...args) => fn(args[0]))
        }
      }
      else {
        logger.withFields({ type: event.type }).log('Message received')

        state.ctx?.emitter.emit(event.type, event.data as CoreEventData<keyof ToCoreEvent>)
      }

      switch (event.type) {
        case 'auth:login':
          state.phoneNumber = event.data.phoneNumber
          state.ctx?.emitter.once('auth:connected', () => {
            state.isConnected = true
          })
          break
        case 'auth:logout':
          state.isConnected = false
          break
      }
    }
    catch (error) {
      logger.withError(error).error('Handle websocket message failed')
    }
  })
}
