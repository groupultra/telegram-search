import type { Config } from '../config-schema'

import { readFile, writeFile } from 'node:fs/promises'

import { safeParse } from 'valibot'
import { parse, stringify } from 'yaml'

import { configSchema } from '../config-schema'
import { useConfigPath } from './path'

export async function loadConfigFromFile(): Promise<Config> {
  const configPath = await useConfigPath()
  const config = await readFile(configPath, 'utf8')
  const result = safeParse(configSchema, parse(config))
  if (!result.success) {
    throw new Error('Failed to parse config', { cause: result.issues })
  }
  return result.output
}

export async function saveConfigToFile(config: Config) {
  const configPath = await useConfigPath()

  const yaml = stringify(config)
  await writeFile(configPath, yaml)
}
