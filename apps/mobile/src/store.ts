// The phone's vault: plain files in the app's private documents folder
// (grail-home/), the same layout as on desktop and on the sync server.

import { Directory, File, Paths } from 'expo-file-system'
import type { FileStore } from '@grail/core'

export function deviceStore(): FileStore {
  const dir = new Directory(Paths.document, 'grail-home')
  if (!dir.exists) dir.create({ intermediates: true })
  const file = (name: string) => new File(dir, name)

  return {
    async list() {
      return dir.list().filter((e): e is File => e instanceof File).map((f) => f.name)
    },
    async read(name) {
      return file(name).bytes()
    },
    async write(name, data) {
      // Write beside, then swap: a crash mid-write never leaves half a note.
      const tmp = file(`.${name}.tmp`)
      if (tmp.exists) tmp.delete()
      tmp.create()
      await tmp.write(data)
      const dest = file(name)
      if (dest.exists) dest.delete()
      tmp.move(dest)
    },
    async remove(name) {
      const f = file(name)
      if (f.exists) f.delete()
    },
    async readText(name) {
      return file(name).text()
    },
    async writeText(name, data) {
      const tmp = file(`.${name}.tmp`)
      if (tmp.exists) tmp.delete()
      tmp.create()
      await tmp.write(data)
      const dest = file(name)
      if (dest.exists) dest.delete()
      tmp.move(dest)
    },
    async stat(name) {
      const f = file(name)
      if (!f.exists) return null
      return { size: f.size, mtime: f.lastModified ?? 0 }
    },
    async hash(name) {
      const f = file(name)
      if (!f.exists) return null
      return (await f.digest('SHA-256')).toLowerCase()
    },
  }
}

/** A vault file's on-disk URI, for <Image> to load natively (no base64 through JS). */
export function fileUri(name: string): string {
  return new File(new Directory(Paths.document, 'grail-home'), name).uri
}

/**
 * Open a vault file (e.g. a PDF snapshot) in another app. Android refuses
 * file:// links between apps, so this hands over a content:// URI instead.
 */
export async function openInViewer(name: string, mime: string): Promise<boolean> {
  try {
    const { startActivityAsync } = await import('expo-intent-launcher')
    const f = new File(new Directory(Paths.document, 'grail-home'), name)
    await startActivityAsync('android.intent.action.VIEW', { data: f.contentUri, type: mime, flags: 1 /* FLAG_GRANT_READ_URI_PERMISSION */ })
    return true
  } catch {
    return false
  }
}

/** A vault image as a data URI (for HTML → PDF). */
export async function imageDataUri(name: string): Promise<string | null> {
  try {
    const f = new File(new Directory(Paths.document, 'grail-home'), name)
    const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
    return `data:${mime};base64,${await f.base64()}`
  } catch {
    return null
  }
}
