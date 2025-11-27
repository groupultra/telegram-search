import process from 'node:process'

import { spawn } from 'node:child_process'

import { initLogger, useLogger } from '@guiiai/logg'

import { getDatabaseDSN, initConfig, parseEnvFlags, useConfig } from '../packages/common/src'

(async () => {
  const flags = parseEnvFlags(process.env)
  await initConfig(flags)
  initLogger(flags.logLevel, flags.logFormat)
  const logger = useLogger('script:drizzle')

  const dsn = getDatabaseDSN(useConfig())
  const args = process.argv.slice(2)

  try {
    const child = spawn('pnpm', ['drizzle-kit', ...args], {
      env: {
        ...process.env,
        DATABASE_DSN: dsn,
      },
      stdio: 'inherit', // Use current terminal's stdin/stdout/stderr
      shell: false,
    })

    await new Promise<void>((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0)
          resolve()
        else
          reject(new Error(`Process exited with code ${code}`))
      })
    })
  }
  catch (error) {
    logger.withError(error).error('Error executing drizzle-kit')
    process.exit(1)
  }
})()
