// A small YAML-frontmatter codec, enough for grail notes. It reads everything
// gray-matter/js-yaml ever wrote for grail (quoted or plain scalars, numbers,
// booleans, block lists and flow lists) and writes output any YAML reader accepts.
// No dependencies, so it runs the same in Node, the browser and React Native.

export type FmValue = string | number | boolean | null | FmValue[]
export type Frontmatter = Record<string, FmValue>

const FENCE = /^---[ \t]*$/

function unquoteSingle(s: string) { return s.slice(1, -1).replace(/''/g, "'") }

function parseScalar(raw: string): FmValue {
  const s = raw.trim()
  if (s === '' || s === '~' || s === 'null') return null
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) return unquoteSingle(s)
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    try { return JSON.parse(s) as string } catch { return s.slice(1, -1) }
  }
  if (s === 'true') return true
  if (s === 'false') return false
  if (/^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(s)) return Number(s)
  return s.replace(/\s+#.*$/, '') // trailing comment
}

// Split a flow list body on commas that aren't inside quotes.
function splitFlow(body: string): string[] {
  const out: string[] = []
  let cur = ''
  let q: string | null = null
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (q) {
      cur += c
      if (c === q && !(q === '"' && body[i - 1] === '\\')) q = null
    } else if (c === '"' || c === "'") { q = c; cur += c }
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  if (cur.trim()) out.push(cur)
  return out
}

function parseValue(raw: string): FmValue {
  const s = raw.trim()
  if (s.startsWith('[') && s.endsWith(']')) return splitFlow(s.slice(1, -1)).map(parseScalar)
  return parseScalar(s)
}

export function parseFrontmatter(text: string): { data: Frontmatter; body: string } {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const lines = src.split('\n')
  if (!FENCE.test(lines[0] ?? '')) return { data: {}, body: src }
  const end = lines.findIndex((l, i) => i > 0 && FENCE.test(l))
  if (end < 0) return { data: {}, body: src }

  const data: Frontmatter = {}
  let listKey: string | null = null
  for (const line of lines.slice(1, end)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    const item = /^\s*-\s?(.*)$/.exec(line)
    if (item && listKey) {
      const list = Array.isArray(data[listKey]) ? (data[listKey] as FmValue[]) : (data[listKey] = [])
      list.push(parseScalar(item[1]))
      continue
    }
    const kv = /^([A-Za-z_][\w-]*)\s*:(.*)$/.exec(line)
    if (!kv) continue
    const [, key, rest] = kv
    // A bare `key:` is null in YAML, unless block-list items follow it.
    if (rest.trim() === '') { data[key] = null; listKey = key }
    else { data[key] = parseValue(rest); listKey = null }
  }
  return { data, body: lines.slice(end + 1).join('\n') }
}

const PLAIN = /^[A-Za-z0-9À-῿぀-￯_./()-][^:#\n]*$/

function formatScalar(v: FmValue): string {
  if (v === null) return 'null'
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return `[${v.map(formatScalar).join(', ')}]`
  const needsQuote = !PLAIN.test(v) || v !== v.trim() || /^(true|false|null|~|yes|no|on|off)$/i.test(v) ||
    /^[-+]?\d/.test(v) || v.includes(', ') || /[\[\]{}]/.test(v)
  return needsQuote ? JSON.stringify(v) : v
}

export function stringifyFrontmatter(data: Frontmatter, body: string): string {
  const yaml = Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${formatScalar(v)}`)
    .join('\n')
  const content = body.endsWith('\n') ? body : `${body}\n`
  return `---\n${yaml}\n---\n${content}`
}
