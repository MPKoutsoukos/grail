// Markdown tables ⇄ editable grids. A note body is split into text, table and
// picture segments; the editor shows tables as grids and pictures as pictures,
// and joins everything back into plain markdown (GitHub-style tables, `![](file)`
// pictures, readable by the desktop and other apps).

export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'image'; line: string; src: string }

const SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/
const isRow = (l: string) => l.trimStart().startsWith('|')
/** A line that is only a picture: `![alt](file)`. The same rule as the markdown renderer's. */
export const IMAGE_LINE = /^!\[[^\]]*\]\(([^)\s]+)\)\s*$/

/** Cells of one `| a | b |` line; `\|` stays a literal pipe. */
export function parseRow(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  const s = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue }
    if (s[i] === '|') { cells.push(cur.trim()); cur = ''; continue }
    cur += s[i]
  }
  cells.push(cur.trim())
  return cells
}

export function splitSegments(body: string): Segment[] {
  const lines = body.split('\n')
  const out: Segment[] = []
  let text: string[] = []
  const flush = () => { if (text.length) { out.push({ kind: 'text', text: text.join('\n') }); text = [] } }
  for (let i = 0; i < lines.length; i++) {
    if (isRow(lines[i]) && i + 1 < lines.length && SEP.test(lines[i + 1])) {
      flush()
      const header = parseRow(lines[i])
      const rows = [header]
      i += 2
      while (i < lines.length && isRow(lines[i])) {
        const r = parseRow(lines[i])
        rows.push(header.map((_, c) => r[c] ?? ''))
        i++
      }
      i--
      out.push({ kind: 'table', rows })
    } else if (IMAGE_LINE.test(lines[i].trim())) {
      flush()
      out.push({ kind: 'image', line: lines[i], src: IMAGE_LINE.exec(lines[i].trim())![1] })
    } else text.push(lines[i])
  }
  flush()
  return out
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')

export function tableMarkdown(rows: string[][]): string {
  const [head, ...rest] = rows
  const line = (r: string[]) => `| ${r.map(cell).join(' | ')} |`
  return [line(head), `| ${head.map(() => '---').join(' | ')} |`, ...rest.map(line)].join('\n')
}

/** Back to one markdown body. Empty text at the very start or end is dropped. */
export function joinSegments(segs: Segment[]): string {
  return segs
    .filter((s, i) => !(s.kind === 'text' && s.text === '' && (i === 0 || i === segs.length - 1)))
    .map((s) => (s.kind === 'text' ? s.text : s.kind === 'image' ? s.line : tableMarkdown(s.rows)))
    .join('\n')
}

/** For editing: always text around and between tables and pictures, so there's somewhere to type. */
export function editableSegments(body: string): Segment[] {
  const segs = splitSegments(body)
  const out: Segment[] = []
  for (const s of segs) {
    if (s.kind !== 'text' && out[out.length - 1]?.kind !== 'text') out.push({ kind: 'text', text: '' })
    out.push(s)
  }
  if (out[out.length - 1]?.kind !== 'text') out.push({ kind: 'text', text: '' })
  return out
}

export const emptyTable = (): string[][] => [['', ''], ['', '']]

/** Does a table start at line i? (a `| … |` row followed by a `| --- |` separator) */
export const tableStartsAt = (lines: string[], i: number) => isRow(lines[i]) && i + 1 < lines.length && SEP.test(lines[i + 1])
