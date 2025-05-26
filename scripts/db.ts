import { spawn } from 'node:child_process'
import process from 'node:process'

import { getDatabaseDSN, initConfig, useConfig } from '../packages/common/src/composable'
import { initLogger, useLogger } from '../packages/common/src/helper/logger'

(async () => {
  initLogger()
  await initConfig()
  const logger = useLogger('script:drizzle')

  const dsn = getDatabaseDSN(useConfig())
  const args = process.argv.slice(2)

  try {
    const child = spawn('pnpm', ['drizzle-kit', ...args], {
      env: {
        ...process.env,
        DATABASE_DSN: dsn,
      },
      stdio: 'pipe',
      shell: true,
    })

    child.stdout.on('data', (data) => {
      console.log(data.toString())
    })

    child.stderr.on('data', (data) => {
      console.error(data.toString())
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
