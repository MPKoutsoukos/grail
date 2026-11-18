// The phone's home: plain files in a folder, the same layout as on desktop. The folder is either
// grail's own (inside the app's private storage) or one the person picked with Android's folder
// picker, a new one or one that already has their notes. Android then grants grail that folder
// only, kept across restarts; no storage permission is needed.
//
// Which folder is in use lives in grail-config.json in the app's own storage, outside the home,
// since it's what says where the home is.

import { Directory, File, Paths } from 'expo-file-system'
import { isHomeFile, type FileStore } from '@grail/core'

export type HomeFolder = { kind: 'app' } | { kind: 'folder'; uri: string }

interface DeviceConfig { folder?: HomeFolder; welcomed?: boolean }

const CONFIG = new File(Paths.document, 'grail-config.json')
const appDir = () => new Directory(Paths.document, 'grail-folder')

function readConfig(): DeviceConfig {
  try { return CONFIG.exists ? (JSON.parse(CONFIG.textSync()) as DeviceConfig) : {} } catch { return {} }
}
function writeConfig(patch: Partial<DeviceConfig>) {
  const next = { ...readConfig(), ...patch }
  if (!CONFIG.exists) CONFIG.create()
  CONFIG.write(JSON.stringify(next))
}

/**
 * The folder in use, and whether this is a first start. A phone that had notes before there was a
 * choice keeps grail's own folder and skips the welcome.
 */
export function loadFolder(): { folder: HomeFolder; firstRun: boolean } {
  const cfg = readConfig()
  if (cfg.folder) return { folder: cfg.folder, firstRun: !cfg.welcomed }
  const dir = appDir()
  const hadNotes = dir.exists && dir.list().some((e) => e instanceof File && e.name.endsWith('.md'))
  if (hadNotes) { writeConfig({ folder: { kind: 'app' }, welcomed: true }); return { folder: { kind: 'app' }, firstRun: false } }
  return { folder: { kind: 'app' }, firstRun: true }
}
export function saveFolder(folder: HomeFolder) { writeConfig({ folder, welcomed: true }) }

/** Android's folder picker. Resolves to null if the person backs out. */
export async function pickFolder(): Promise<HomeFolder | null> {
  try {
    const dir = await Directory.pickDirectoryAsync()
    return { kind: 'folder', uri: dir.uri }
  } catch {
    return null
  }
}

/** Where the notes are, in words: "grail's own folder", or "Documents/grail (phone storage)". */
export function folderLabel(folder: HomeFolder): { title: string; detail: string } {
  if (folder.kind === 'app') return { title: 'grail’s own folder', detail: 'Inside the app on this phone. Uninstalling grail deletes it.' }
  try {
    const u = folder.uri.replace(/\/$/, '')
    const tree = decodeURIComponent(u.slice(u.indexOf('/tree/') + 6).split('/')[0])
    const [vol, ...rest] = tree.split(':')
    const path = rest.join(':')
    if (u.includes('com.android.externalstorage.documents')) {
      const where = vol === 'primary' ? 'phone storage' : 'SD card'
      return { title: path || (vol === 'primary' ? 'Phone storage' : 'SD card'), detail: `On this phone’s ${where}` }
    }
    return { title: path || tree, detail: 'A folder you chose' }
  } catch {
    return { title: 'A folder you chose', detail: folder.uri }
  }
}

// ---------------------------------------------------------------- backings ---

interface Backing extends FileStore {
  /** A file's URI, for <Image> to load natively (no base64 through JS). */
  uriOf(name: string): string
  file(name: string): File | null
}

const writeSwap = async (dir: Directory, name: string, data: Uint8Array | string) => {
  // Write beside, then swap: a crash mid-write never leaves half a note.
  const tmp = new File(dir, `.${name}.tmp`)
  if (tmp.exists) tmp.delete()
  tmp.create()
  await tmp.write(data as Uint8Array)
  const dest = new File(dir, name)
  if (dest.exists) dest.delete()
  tmp.move(dest)
}

/** grail's own folder: plain file:// paths. */
function appBacking(): Backing {
  const dir = appDir()
  if (!dir.exists) dir.create({ intermediates: true })
  const file = (name: string) => new File(dir, name)
  return {
    uriOf: (name) => file(name).uri,
    file: (name) => file(name),
    async list() { return dir.list().filter((e): e is File => e instanceof File).map((f) => f.name) },
    async read(name) { return file(name).bytes() },
    async write(name, data) { await writeSwap(dir, name, data) },
    async remove(name) { const f = file(name); if (f.exists) f.delete() },
    async readText(name) { return file(name).text() },
    async writeText(name, data) { await writeSwap(dir, name, data) },
    async stat(name) { const f = file(name); return f.exists ? { size: f.size, mtime: f.lastModified ?? 0 } : null },
    async hash(name) { const f = file(name); return f.exists ? (await f.digest('SHA-256')).toLowerCase() : null },
  }
}

/**
 * A picked folder (content:// URIs from Android's Storage Access Framework). A file there is found
 * by listing the folder, so the names are kept in an index, refreshed on every list().
 */
function folderBacking(uri: string): Backing {
  const dir = new Directory(uri)
  const index = new Map<string, File>()
  const refresh = () => {
    index.clear()
    const entries = dir.list()
    const names = dir.info().files ?? []
    entries.forEach((e, i) => {
      if (!(e instanceof File)) return
      // The provider's display names come in the same order as the entries; the URI is the fallback.
      const name = names.length === entries.length ? names[i] : decodeURIComponent(e.uri).split('/').pop()
      if (name) index.set(name, e)
    })
  }
  const get = (name: string) => {
    if (!index.has(name)) refresh()
    return index.get(name) ?? null
  }
  const create = (name: string) => {
    // octet-stream: the provider keeps the name exactly as given (no ".txt" added).
    const f = dir.createFile(name, 'application/octet-stream')
    index.set(name, f)
    return f
  }
  const put = async (name: string, data: Uint8Array | string) => {
    const size = typeof data === 'string' ? new TextEncoder().encode(data).length : data.length
    let f = get(name)
    if (f) {
      await f.write(data as Uint8Array)
      // Some providers don't cut a file short when rewriting it: then start the file afresh.
      if (f.size > size) { f.delete(); f = create(name); await f.write(data as Uint8Array) }
    } else {
      f = create(name)
      await f.write(data as Uint8Array)
    }
  }
  refresh()
  return {
    uriOf: (name) => get(name)?.uri ?? '',
    file: get,
    async list() { refresh(); return [...index.keys()] },
    async read(name) {
      const f = get(name)
      if (!f) throw new Error(`not found: ${name}`)
      return f.bytes()
    },
    async write(name, data) { await put(name, data) },
    async remove(name) { const f = get(name); if (f) { try { f.delete() } catch { /* gone */ } index.delete(name) } },
    async readText(name) {
      const f = get(name)
      if (!f) throw new Error(`not found: ${name}`)
      return f.text()
    },
    async writeText(name, data) { await put(name, data) },
    async stat(name) { const f = get(name); return f ? { size: f.size, mtime: f.lastModified ?? 0 } : null },
  }
}

let current: Backing | null = null

/** Opens the home's folder; every other function here works on the one opened last. */
export function deviceStore(folder: HomeFolder): FileStore {
  current = folder.kind === 'folder' ? folderBacking(folder.uri) : appBacking()
  return current
}

/** How many notes a folder already holds, and how many of them are plain markdown from elsewhere. */
export async function countNotes(store: FileStore): Promise<{ notes: number; plain: number }> {
  const names = (await store.list()).filter((n) => n.endsWith('.md') && isHomeFile(n))
  let plain = 0
  for (const n of names) {
    try {
      const head = store.readText ? (await store.readText(n)).slice(0, 8) : ''
      if (!/^﻿?---/.test(head)) plain++
    } catch { /* unreadable: not counted as plain */ }
  }
  return { notes: names.length, plain }
}

/** Copies every grail file from one folder to another, skipping names the target already has. */
export async function copyHome(from: FileStore, to: FileStore): Promise<number> {
  const have = new Set(await to.list())
  let copied = 0
  for (const n of (await from.list()).filter(isHomeFile)) {
    if (have.has(n)) continue
    await to.write(n, await from.read(n))
    copied++
  }
  return copied
}

/** A home file's URI, for <Image> to load natively (no base64 through JS). */
export function fileUri(name: string): string {
  return current?.uriOf(name) ?? ''
}

/**
 * Open a home file (e.g. a PDF snapshot) in another app. Android refuses
 * file:// links between apps, so this hands over a content:// URI instead.
 */
export async function openInViewer(name: string, mime: string): Promise<boolean> {
  try {
    const { startActivityAsync } = await import('expo-intent-launcher')
    const f = current?.file(name)
    if (!f) return false
    await startActivityAsync('android.intent.action.VIEW', { data: f.contentUri, type: mime, flags: 1 /* FLAG_GRANT_READ_URI_PERMISSION */ })
    return true
  } catch {
    return false
  }
}

/** A home image as a data URI (for HTML → PDF). */
export async function imageDataUri(name: string): Promise<string | null> {
  try {
    const f = current?.file(name)
    if (!f) return null
    const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
    return `data:${mime};base64,${await f.base64()}`
  } catch {
    return null
  }
}
