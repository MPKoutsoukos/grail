// The grail note: one markdown file with frontmatter. Its title decides its role:
//   "#name" + empty body   → the page for tag `name`
//   "2026-06-13 14:02"     → a fragment, gathered into Read
//   anything else          → a loose note

import { parseFrontmatter, stringifyFrontmatter, type Frontmatter } from './frontmatter.ts'

// 'snapshot' = a saved copy of a notebook (markdown body, or a PDF in mediaPath). It never carries tags,
// so it doesn't show up inside the notebooks it was made from.
export type NoteType = 'text' | 'drawing' | 'media' | 'snapshot'

export interface Note {
  id: string
  type: NoteType
  title: string
  body: string
  tags: string[]
  created: number
  updated: number
  drawingPath?: string
  mediaPath?: string
}

export type NoteKind = 'category' | 'timeline' | 'loose'

const DATETIME_TITLE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/
const TAG = /#[\wͰ-Ͽἀ-῿]+/g

const pad = (n: number) => String(n).padStart(2, '0')
export function defaultTitle(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const noteFilename = (id: string) => `${id}.md`

export function noteToMarkdown(note: Note): string {
  const data: Frontmatter = {
    id: note.id,
    type: note.type,
    title: note.title,
    tags: note.tags,
    created: note.created,
    updated: note.updated,
  }
  if (note.drawingPath) data.drawingPath = note.drawingPath
  if (note.mediaPath) data.mediaPath = note.mediaPath
  return stringifyFrontmatter(data, note.body)
}

const str = (v: unknown) => (v == null ? undefined : String(v))
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || fallback)

/** Whether a file starts with a frontmatter block (grail's notes always do; plain markdown from elsewhere may not). */
export const hasFrontmatter = (raw: string) => /^﻿?---[ \t]*\r?\n/.test(raw)

/**
 * `fileTime` (the file's modification time) dates a note that has no dates of its own, such as plain
 * markdown from another app, so it keeps its place instead of looking new on every start.
 */
export function markdownToNote(filename: string, raw: string, fileTime?: number): Note {
  const { data, body } = parseFrontmatter(raw)
  const type: NoteType = data.type === 'drawing' || data.type === 'media' || data.type === 'snapshot' ? data.type : 'text'
  const when = fileTime && fileTime > 0 ? fileTime : Date.now()
  return {
    id: str(data.id) ?? filename.replace(/\.md$/, ''),
    type,
    title: str(data.title) ?? '',
    body: body.trim(),
    // grail writes the body's #tags here on every save; a file without the list gets them from its text.
    tags: Array.isArray(data.tags) ? data.tags.map(String) : type === 'snapshot' ? [] : extractHashtags(body),
    created: num(data.created, when),
    updated: num(data.updated, when),
    drawingPath: str(data.drawingPath),
    mediaPath: str(data.mediaPath),
  }
}

export function categoryName(note: Note): string | null {
  const title = note.title.trim()
  if (!title.startsWith('#') || note.body.trim() !== '') return null
  return title.slice(1).trim().toLowerCase() || null
}

export function noteKind(note: Note): NoteKind {
  if (categoryName(note)) return 'category'
  if (DATETIME_TITLE.test(note.title.trim())) return 'timeline'
  return 'loose'
}

export function looseTitle(note: Note): string {
  const first = note.body.split('\n').map((s) => s.trim()).find(Boolean) ?? ''
  const t = first.replace(/^#+\s*/, '').trim().slice(0, 60)
  return !t || DATETIME_TITLE.test(t) ? 'Untitled' : t
}

export function inCategory(note: Note, cat: string): boolean {
  return note.tags.includes(cat) || categoryName(note) === cat
}

export function collectCategories(notes: Note[]): { name: string; count: number }[] {
  const names = new Set<string>()
  for (const n of notes) {
    const defined = categoryName(n)
    if (defined) names.add(defined)
    n.tags.forEach((t) => names.add(t))
  }
  return [...names]
    .map((name) => ({ name, count: notes.filter((n) => inCategory(n, name)).length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export function extractHashtags(text: string): string[] {
  return [...new Set((text.match(TAG) ?? []).map((t) => t.slice(1).toLowerCase()))]
}

// First meaningful line of a body, without markdown punctuation or #tags.
export function excerpt(body: string, max = 140): string {
  const line = body
    .split('\n')
    .map((l) => l.replace(/(^|\s)#[\wͰ-Ͽἀ-῿]+/g, '').replace(/^[#>*\-\d.\s]+/, '').trim())
    .find(Boolean) ?? ''
  return line.length > max ? `${line.slice(0, max)}…` : line
}

// A tag's own read: everything tagged with it, minus its empty "#tag" page.
export function categoryPool(notes: Note[], cat: string): Note[] {
  return notes.filter((n) => inCategory(n, cat) && noteKind(n) !== 'category')
}

/**
 * A notebook as one markdown document, for snapshots: fragments in reading
 * order, a quiet date line whenever the day changes, images as references
 * to their home files. #tags are kept as written but the snapshot note itself
 * carries none (see NoteType 'snapshot').
 */
export function notebookMarkdown(title: string, notes: Note[]): string {
  const out: string[] = [`# ${title}`, '']
  let lastDay = ''
  for (const n of notes) {
    const d = new Date(n.created)
    const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    if (day !== lastDay) { out.push(`*${day}*`, ''); lastDay = day }
    const pic = n.drawingPath ?? n.mediaPath
    if (pic) out.push(`![](${pic})`, '')
    if (n.body.trim()) out.push(n.body.trim(), '')
  }
  return out.join('\n').trim() + '\n'
}
