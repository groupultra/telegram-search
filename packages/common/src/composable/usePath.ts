import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { cwd } from 'node:process'

import { useConfig } from './config'

export function usePaths() {
  const config = useConfig()
  const storagePath = resolveHomeDir(config.path.storage)
  const sessionPath = join(storagePath, 'sessions')
  const mediaPath = join(storagePath, 'media')
  const configPath = resolve(cwd(), './config/config.yaml')

  function resolveHomeDir(dir: string): string {
    if (dir.startsWith('~/')) {
      return join(homedir(), dir.slice(2))
    }

    return dir
  }

  return {
    resolveHomeDir,

    configPath,
    storagePath,
    sessionPath,
    mediaPath,
  }
}
