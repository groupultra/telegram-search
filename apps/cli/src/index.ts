import process from 'node:process'
import { initConfig, initDB, initLogger, useLogger } from '@tg-search/common'

import { registerCommands, setupCli } from './cli'

// Initialize logger and config
initLogger()
initConfig()
initDB()

const logger = useLogger()

// Global error handler
process.on('unhandledRejection', (error) => {
  logger.withError(error).error('Unhandled promise rejection:')
})

// Graceful shutdown handler
process.on('SIGINT', () => {
  logger.log('正在关闭应用...')
  process.exit(0)
})

// Exit handler
process.on('exit', (code) => {
  logger.log(`应用已退出，退出码: ${code}`)
})

// Export main entry point
export default function main() { // Register commands
  registerCommands()

  // Setup CLI
  const program = setupCli()

  // Parse command line arguments
  if (process.argv.length <= 2) {
    program.help()
  }
  else {
    program.parse()
  }
}

main()
