// The phone's home state: notes, settings, saved views and Read order, kept
// in the same files (and with the same rules) as the desktop app.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_THEME, SIDECARS, Home, type Note, type Theme } from '@grail/core'
import { copyHome, deviceStore, loadFolder, saveFolder, type HomeFolder } from './store'
import type { ReadingFont } from './theme'

export type ReviewTemplate = 'manuscript' | 'timeline' | 'codex' | 'cards'
export interface Settings {
  theme: Theme
  readingFont: ReadingFont
  reviewTemplate: ReviewTemplate
  echoes: boolean
  haptics: boolean
  linkPreviews: boolean // true: fetch link previews by themselves; false: ask each time
  [k: string]: unknown // fields only the desktop uses travel along untouched
}
const DEFAULT_SETTINGS: Settings = { theme: DEFAULT_THEME, readingFont: 'serif', reviewTemplate: 'manuscript', echoes: true, haptics: true, linkPreviews: false }

export interface SavedView { id: string; name: string; query: string; created: number }
interface ReviewState { order: string[]; removed: string[] }
type ReviewMap = Record<string, ReviewState>

/** A JSON sidecar as state: re-read when sync changes it, written only on real edits. */
function useSidecar<T>(home: Home | null, name: string, fallback: T, epoch: number, normalize: (raw: unknown) => T) {
  const [value, setValue] = useState<T>(fallback)
  const [ready, setReady] = useState(false)
  const dirty = useRef(false)
  const norm = useRef(normalize)
  useEffect(() => { norm.current = normalize })
  useEffect(() => {
    if (!home) return
    let cancelled = false
    home.readJson<unknown>(name, null).then((raw) => {
      if (cancelled) return
      setValue(norm.current(raw)); setReady(true)
    })
    return () => { cancelled = true }
  }, [home, name, epoch])
  useEffect(() => {
    if (!home || !dirty.current) return
    dirty.current = false
    void home.writeJson(name, value)
  }, [home, name, value])
  const update = useCallback((fn: (p: T) => T) => { dirty.current = true; setValue(fn) }, [])
  return [value, update, ready] as const
}

function orderedIds(eligible: Note[], rs: ReviewState): string[] {
  const exists = new Set(eligible.map((n) => n.id))
  const removed = new Set(rs.removed)
  const ids = [...new Set(rs.order)].filter((id) => exists.has(id) && !removed.has(id))
  const seen = new Set(ids)
  eligible.filter((n) => !seen.has(n.id) && !removed.has(n.id)).sort((a, b) => a.created - b.created).forEach((n) => ids.push(n.id))
  return ids
}

function useData() {
  const [{ folder, firstRun }, setFolderState] = useState(loadFolder)
  const [home, setHome] = useState<Home | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [folderError, setHomeError] = useState<string | null>(null)
  const [epoch, setEpoch] = useState(0)

  // Open the folder; again whenever it changes.
  useEffect(() => {
    let cancelled = false
    setLoading(true); setHomeError(null)
    ;(async () => {
      try {
        const v = new Home(deviceStore(folder))
        const n = await v.loadNotes()
        if (!cancelled) { setHome(v); setNotes(n) }
      } catch (e) {
        // The folder was deleted, or Android no longer lets grail into it.
        if (!cancelled) { setHome(null); setNotes([]); setHomeError(e instanceof Error ? e.message : String(e)) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [folder])

  /** Switch to another folder, optionally bringing the current notes along (files it already has are kept). */
  const setFolder = useCallback(async (next: HomeFolder, bringNotes = false) => {
    if (bringNotes && home) {
      const target = deviceStore(next)
      await copyHome(home.store, target)
    }
    saveFolder(next)
    setFolderState((s) => ({ folder: next, firstRun: s.firstRun }))
  }, [home])
  const finishWelcome = useCallback(() => { saveFolder(folder); setFolderState((s) => ({ ...s, firstRun: false })) }, [folder])

  // Sync brought files in: patch just those notes; re-read sidecars if one changed.
  useEffect(() => {
    if (!home) return
    return home.onRemote(async (names) => {
      const ids = names.filter((n) => n.endsWith('.md')).map((n) => n.slice(0, -3))
      if (ids.length) {
        const fresh = await Promise.all(ids.map(async (id) => [id, await home.readNote(id)] as const))
        setNotes((prev) => {
          let next = prev
          for (const [id, note] of fresh) {
            const without = next.filter((n) => n.id !== id)
            next = note ? [note, ...without] : without
          }
          return [...next].sort((a, b) => b.created - a.created)
        })
      }
      if (names.some((n) => n.endsWith('.json') && !n.endsWith('.scene.json'))) setEpoch((e) => e + 1)
    })
  }, [home])

  const [settings, setSettings, settingsReady] = useSidecar<Settings>(home, SIDECARS.settings, DEFAULT_SETTINGS, epoch,
    (raw) => ({ ...DEFAULT_SETTINGS, ...(raw as Partial<Settings> | null) }))
  const [views, setViews] = useSidecar<SavedView[]>(home, SIDECARS.views, [], epoch, (raw) => (Array.isArray(raw) ? raw : []))
  const [review, setReview] = useSidecar<ReviewMap>(home, SIDECARS.review, {}, epoch, (raw) => {
    const p = raw as { order?: string[]; removed?: string[] } | null
    if (p && (Array.isArray(p.order) || Array.isArray(p.removed))) return { '': { order: p.order ?? [], removed: p.removed ?? [] } }
    return p && typeof p === 'object' ? (p as ReviewMap) : {}
  })

  const saveNote = useCallback(async (note: Note) => {
    if (!home) return note
    const saved = await home.saveNote(note)
    setNotes((prev) => (prev.some((n) => n.id === saved.id) ? prev.map((n) => (n.id === saved.id ? saved : n)) : [saved, ...prev]))
    return saved
  }, [home])

  const createNote = useCallback(async (type: Note['type']) => saveNote(home!.newNote(type)), [home, saveNote])

  const deleteNote = useCallback(async (id: string) => {
    if (!home) return
    const note = notes.find((n) => n.id === id)
    if (note) await home.deleteNote(note)
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }, [home, notes])

  const reviewView = useCallback((key: string, eligible: Note[]) => {
    const rs = review[key] ?? { order: [], removed: [] }
    const byId = new Map(eligible.map((n) => [n.id, n]))
    const patch = (fn: (r: ReviewState) => ReviewState) => setReview((p) => ({ ...p, [key]: fn(p[key] ?? { order: [], removed: [] }) }))
    return {
      compiled: orderedIds(eligible, rs).map((id) => byId.get(id)!),
      removedIds: new Set(rs.removed),
      move: (id: string, dir: -1 | 1) => patch((cur) => {
        const ids = orderedIds(eligible, cur)
        const i = ids.indexOf(id), j = i + dir
        if (i < 0 || j < 0 || j >= ids.length) return cur
        ;[ids[i], ids[j]] = [ids[j], ids[i]]
        return { ...cur, order: ids }
      }),
      /** Reattach: put `id` at position `to` among the others. */
      place: (id: string, to: number) => patch((cur) => {
        const ids = orderedIds(eligible, cur).filter((x) => x !== id)
        ids.splice(Math.max(0, Math.min(to, ids.length)), 0, id)
        return { ...cur, order: ids }
      }),
      remove: (id: string) => patch((cur) => ({ ...cur, removed: [...new Set([...cur.removed, id])] })),
    }
  }, [review, setReview])

  return useMemo(() => ({
    folder, firstRun, folderError, setFolder, finishWelcome,
    home, notes, loading: loading || (!folderError && !settingsReady), settings,
    updateSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((p) => ({ ...p, [k]: v })),
    views,
    addView: (name: string, query: string) => setViews((p) => [...p, { id: String(Date.now()), name: name.trim() || 'Untitled view', query, created: Date.now() }]),
    removeView: (id: string) => setViews((p) => p.filter((v) => v.id !== id)),
    reviewView, saveNote, createNote, deleteNote,
  }), [folder, firstRun, folderError, setFolder, finishWelcome, home, notes, loading, settingsReady, settings, setSettings, views, setViews, reviewView, saveNote, createNote, deleteNote])
}

export type Data = ReturnType<typeof useData>
const Ctx = createContext<Data | null>(null)
export const useGrail = () => useContext(Ctx)!
export function DataProvider({ children }: { children: (d: Data) => ReactNode }) {
  const d = useData()
  return <Ctx.Provider value={d}>{children(d)}</Ctx.Provider>
}
