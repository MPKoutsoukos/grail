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
  /** Read from a file without grail's header (plain markdown from another app). Not saved: the first save adds the header. */
  plain?: boolean
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
  const plain = !hasFrontmatter(raw)
  const name = filename.replace(/\.md$/, '')
  return {
    id: str(data.id) ?? name,
    type,
    // A plain file's name is its title ("Shopping list.md" → "Shopping list"), as in other markdown apps.
    title: str(data.title) ?? (plain ? name : ''),
    ...(plain ? { plain: true } : {}),
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

// Deleting a note doesn't remove its file: it gets the #deleted tag, written into its text like any tag.
// A #deleted note is hidden everywhere (Browse, Read, Tags, Echoes) until a search asks for #deleted;
// taking the tag out of the text brings it back.
export const DELETED_TAG = 'deleted'
export const isDeleted = (note: Note) => note.tags.includes(DELETED_TAG)
const DELETED_IN_TEXT = /(^|\s)#deleted(?![\wͰ-Ͽἀ-῿])/gi

/** The note moved to #deleted (its text gains the tag on a line of its own). */
export function markDeleted(note: Note): Note {
  if (isDeleted(note)) return note
  const body = note.body.trimEnd()
  return { ...note, body: body ? `${body}\n\n#${DELETED_TAG}` : `#${DELETED_TAG}`, tags: [...note.tags, DELETED_TAG] }
}

/** The note out of #deleted again. */
export function restoreNote(note: Note): Note {
  const body = note.body.replace(DELETED_IN_TEXT, '$1').replace(/\n{3,}/g, '\n\n').trim()
  return { ...note, body, tags: note.tags.filter((t) => t !== DELETED_TAG) }
}

/** Whether a search or query asks for deleted notes (it mentions #deleted). */
export const wantsDeleted = (q: string) => /(^|\s)-?#deleted(?![\wͰ-Ͽἀ-῿])/i.test(q)

export function inCategory(note: Note, cat: string): boolean {
  if (cat !== DELETED_TAG && isDeleted(note)) return false
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
    .filter((t) => t.count > 0)
    // #deleted always comes last, after the tags in use
    .sort((a, b) => Number(a.name === DELETED_TAG) - Number(b.name === DELETED_TAG) || b.count - a.count || a.name.localeCompare(b.name))
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
