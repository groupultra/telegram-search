import { randomUUID } from 'node:crypto'
import { chmod, rename, rm, writeFile } from 'node:fs/promises'

/**
 * Replaces `path` in one rename, so a concurrent `tgs` process reads either the
 * old contents or the new ones and never an empty or half-written file.
 */
export async function writeFileAtomic(path: string, contents: string, mode = 0o600): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, contents, { mode })
    await chmod(temporary, mode)
    await rename(temporary, path)
  }
  finally {
    await rm(temporary, { force: true })
  }
}
