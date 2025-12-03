import process from 'node:process'

import { spawn } from 'node:child_process'

import { initLogger, useLogger } from '@guiiai/logg'

import { getDatabaseDSN, mergeConfigWithEnv, parseEnvFlags } from '../packages/common/src'
import { loadConfigFromFile } from '../packages/common/src/node'

(async () => {
  const flags = parseEnvFlags(process.env)
  initLogger(flags.logLevel, flags.logFormat)

  const config = mergeConfigWithEnv(process.env, await loadConfigFromFile())

  const logger = useLogger('script:drizzle')

  const dsn = getDatabaseDSN(config.database)
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
