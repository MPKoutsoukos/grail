// The vault: grail's notes and sidecars on top of a FileStore. Local writes are
// announced (sync queues them); files sync writes are announced separately, so
// the UI can refresh without re-queueing them.

import { bytesToDataUrl, dataUrlToBytes, extForMime } from './bytes.ts'
import { defaultTitle, extractHashtags, markdownToNote, noteToMarkdown, type Note } from './note.ts'
import { readText, writeText, type FileStore } from './store.ts'

export const SIDECARS = {
  review: 'grail-review.json',
  settings: 'grail-settings.json',
  views: 'grail-views.json',
} as const

/** Files grail owns and syncs. Anything else in the folder is left alone. */
export function isVaultFile(name: string): boolean {
  if (name.startsWith('.') || name.includes('/') || name.includes('\\')) return false
  return /\.(md|png|jpe?g|webp|gif|pdf)$/i.test(name) ||
    name.endsWith('.scene.json') ||
    (Object.values(SIDECARS) as string[]).includes(name)
}

type Listener = (names: string[]) => void

export class Vault {
  readonly store: FileStore
  private local = new Set<Listener>()
  private remote = new Set<Listener>()
  private images = new Map<string, string>()

  constructor(store: FileStore) { this.store = store }

  /** Local edits (sync queues these). */
  onWrite(fn: Listener) { this.local.add(fn); return () => { this.local.delete(fn) } }
  /** Changes sync brought in from elsewhere (the UI reloads on these). */
  onRemote(fn: Listener) { this.remote.add(fn); return () => { this.remote.delete(fn) } }
  private wrote(...names: string[]) { this.local.forEach((fn) => fn(names)) }

  // ---- used by sync: writes that must not be queued again ------------------
  async applyRemote(name: string, data: Uint8Array | null) {
    if (data) await this.store.write(name, data)
    else await this.store.remove(name)
    this.images.delete(name)
  }
  announceRemote(names: string[]) { if (names.length) this.remote.forEach((fn) => fn(names)) }

  // ---- notes ---------------------------------------------------------------
  async loadNotes(): Promise<Note[]> {
    const names = (await this.store.list()).filter((n) => n.endsWith('.md') && isVaultFile(n))
    const notes = await Promise.all(names.map(async (n) => {
      try { return markdownToNote(n, await readText(this.store, n)) } catch { return null }
    }))
    return notes.filter((n): n is Note => !!n).sort((a, b) => b.created - a.created)
  }

  async readNote(id: string): Promise<Note | null> {
    try { return markdownToNote(`${id}.md`, await readText(this.store, `${id}.md`)) } catch { return null }
  }

  newNote(type: Note['type'], body = ''): Note {
    const now = Date.now()
    return { id: String(now), type, body, title: defaultTitle(), tags: extractHashtags(body), created: now, updated: now }
  }

  async saveNote(note: Note): Promise<Note> {
    const next = { ...note, tags: note.type === 'snapshot' ? [] : extractHashtags(note.body), updated: Date.now() }
    const name = `${note.id}.md`
    await writeText(this.store, name, noteToMarkdown(next))
    this.wrote(name)
    return next
  }

  /** Removes the note and its attachments. */
  async deleteNote(note: Note) {
    const names = [`${note.id}.md`, `${note.id}.scene.json`, note.drawingPath, note.mediaPath]
      .filter((n): n is string => !!n && !n.startsWith('data:'))
    await Promise.all(names.map((n) => this.store.remove(n).catch(() => {})))
    names.forEach((n) => this.images.delete(n))
    this.wrote(...names)
  }

  // ---- attachments ---------------------------------------------------------
  async saveImage(base: string, dataUrl: string): Promise<string> {
    const { bytes, mime } = dataUrlToBytes(dataUrl)
    const name = base.includes('.') ? base : `${base}.${extForMime(mime)}`
    await this.store.write(name, bytes)
    this.images.set(name, dataUrl)
    this.wrote(name)
    return name
  }

  async loadImage(name: string): Promise<string> {
    if (name.startsWith('data:')) return name
    const hit = this.images.get(name)
    if (hit) return hit
    const url = bytesToDataUrl(name, await this.store.read(name))
    this.images.set(name, url)
    return url
  }

  async readScene(id: string): Promise<string | null> {
    try { return await readText(this.store, `${id}.scene.json`) } catch { return null }
  }
  async writeScene(id: string, json: string) {
    const name = `${id}.scene.json`
    await writeText(this.store, name, json)
    this.wrote(name)
  }

  // ---- sidecars ------------------------------------------------------------
  async readJson<T>(name: string, fallback: T): Promise<T> {
    try { return JSON.parse(await readText(this.store, name)) as T } catch { return fallback }
  }
  async writeJson(name: string, value: unknown) {
    await writeText(this.store, name, JSON.stringify(value, null, 1))
    this.wrote(name)
  }
}
