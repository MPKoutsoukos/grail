import type { Note } from './note.ts'
import { inCategory } from './note.ts'

// An Obsidian-like tag query. The string is whitespace-tokenised:
//   #tag      → note belongs to category `tag`
//   word      → note's title/body/tags contain `word`
//   -#tag     → note must NOT belong to `tag`
//   -word     → note's text must NOT contain `word`
//   OR        → splits the query into alternative groups
// Within a group every term must hold (AND); a note matches if ANY group holds.

interface Term { negate: boolean; tag: string | null; text: string | null }
type Group = Term[]

function parseTerm(raw: string): Term | null {
  let s = raw
  const negate = s.startsWith('-')
  if (negate) s = s.slice(1)
  if (!s) return null
  if (s.startsWith('#')) {
    const tag = s.slice(1).toLowerCase()
    return tag ? { negate, tag, text: null } : null
  }
  return { negate, tag: null, text: s.toLowerCase() }
}

function parseQuery(q: string): Group[] {
  const tokens = q.trim().split(/\s+/).filter(Boolean)
  const groups: Group[] = []
  let cur: Group = []
  for (const tok of tokens) {
    if (tok.toUpperCase() === 'OR') { groups.push(cur); cur = []; continue }
    const term = parseTerm(tok)
    if (term) cur.push(term)
  }
  groups.push(cur)
  return groups.filter((g) => g.length > 0)
}

function textHit(note: Note, needle: string): boolean {
  return (
    note.title.toLowerCase().includes(needle) ||
    note.body.toLowerCase().includes(needle) ||
    note.tags.some((t) => t.toLowerCase().includes(needle))
  )
}

// Plain substring search over title/body/tags (empty = match all). Used by the
// Browse tab and a category's drill-in — distinct from the #tag query grammar.
export function matchesText(note: Note, q: string): boolean {
  const needle = q.trim().toLowerCase()
  return needle ? textHit(note, needle) : true
}

function termHolds(note: Note, t: Term): boolean {
  const hit = t.tag !== null ? inCategory(note, t.tag) : textHit(note, t.text!)
  return t.negate ? !hit : hit
}

export function isQueryActive(q: string): boolean {
  return parseQuery(q).length > 0
}

export function matchesQuery(note: Note, q: string): boolean {
  const groups = parseQuery(q)
  if (groups.length === 0) return true
  return groups.some((g) => g.every((t) => termHolds(note, t)))
}

// Which category tags the query currently includes / excludes — for highlighting
// the category chip strip (flattened across OR groups; good enough for display).
export function queryTags(q: string): { include: Set<string>; exclude: Set<string> } {
  const include = new Set<string>()
  const exclude = new Set<string>()
  for (const tok of q.trim().split(/\s+/).filter(Boolean)) {
    if (tok.toUpperCase() === 'OR') continue
    const term = parseTerm(tok)
    if (term?.tag) (term.negate ? exclude : include).add(term.tag)
  }
  return { include, exclude }
}

// Toggle a category's #tag in the query string: remove it if present in either
// form (#tag or -#tag), otherwise append it as an include.
export function toggleQueryTag(q: string, name: string): string {
  const tag = `#${name.toLowerCase()}`
  const tokens = q.trim().split(/\s+/).filter(Boolean)
  const idx = tokens.findIndex((t) => {
    const x = t.toLowerCase()
    return x === tag || x === `-${tag}`
  })
  if (idx >= 0) tokens.splice(idx, 1)
  else tokens.push(tag)
  return tokens.join(' ')
}
