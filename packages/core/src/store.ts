import { fromUtf8, utf8 } from './bytes.ts'

/** A flat folder of files: the only thing each platform has to provide. */
export interface FileStore {
  list(): Promise<string[]>
  read(name: string): Promise<Uint8Array>
  write(name: string, data: Uint8Array): Promise<void>
  remove(name: string): Promise<void>
  /** Optional fast paths for text. */
  readText?(name: string): Promise<string>
  writeText?(name: string, data: string): Promise<void>
  /** Optional: lets sync skip re-hashing files that haven't changed on disk. */
  stat?(name: string): Promise<{ size: number; mtime: number } | null>
  /** Optional: SHA-256 (lowercase hex) computed natively, without moving the bytes into JS. */
  hash?(name: string): Promise<string | null>
}

export const readText = (s: FileStore, name: string) =>
  s.readText ? s.readText(name) : s.read(name).then(fromUtf8)
export const writeText = (s: FileStore, name: string, data: string) =>
  s.writeText ? s.writeText(name, data) : s.write(name, utf8(data))

/** In-memory store, for tests and previews. */
export function memoryStore(): FileStore & { files: Map<string, Uint8Array> } {
  const files = new Map<string, Uint8Array>()
  return {
    files,
    list: async () => [...files.keys()],
    read: async (n) => {
      const f = files.get(n)
      if (!f) throw new Error(`not found: ${n}`)
      return f
    },
    write: async (n, d) => { files.set(n, d) },
    remove: async (n) => { files.delete(n) },
  }
}
