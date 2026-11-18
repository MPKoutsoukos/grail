// A small native markdown renderer for grail notes: headings, paragraphs,
// lists, quotes, code, rules, **bold**, *italic*, `code`, [links](…), bare web
// addresses (with a preview card under them, see linkpreview.tsx) and quiet #tags.
// Plain <Text>, so it scrolls at full speed inside long lists.

import { memo, type ReactNode } from 'react'
import { Image, Linking, ScrollView, Text, View } from 'react-native'
import { parseRow, tableStartsAt } from './table'
import { RevealImage } from './images'
import { alpha, F, useTheme } from './theme'
import { LinkCards, urlsIn } from './linkpreview'

type Block =
  | { t: 'h'; level: number; text: string }
  | { t: 'p'; text: string }
  | { t: 'quote'; text: string }
  | { t: 'li'; ordered: boolean; n: number; text: string }
  | { t: 'code'; text: string }
  | { t: 'hr' }
  | { t: 'img'; src: string }
  | { t: 'table'; rows: string[][] }

function blocks(md: string): Block[] {
  const out: Block[] = []
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  let para: string[] = []
  const flush = () => { if (para.length) { out.push({ t: 'p', text: para.join(' ') }); para = [] } }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('```')) {
      flush()
      const code: string[] = []
      while (++i < lines.length && !lines[i].startsWith('```')) code.push(lines[i])
      out.push({ t: 'code', text: code.join('\n') })
      continue
    }
    if (!line.trim()) { flush(); continue }
    let m: RegExpExecArray | null
    if ((m = /^!\[[^\]]*\]\(([^)\s]+)\)\s*$/.exec(line.trim()))) { flush(); out.push({ t: 'img', src: m[1] }); continue }
    if (tableStartsAt(lines, i)) {
      flush()
      const header = parseRow(lines[i])
      const rows = [header]
      i += 2
      while (i < lines.length && lines[i].trimStart().startsWith('|')) { const r = parseRow(lines[i]); rows.push(header.map((_, c) => r[c] ?? '')); i++ }
      i--
      out.push({ t: 'table', rows })
      continue
    }
    if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) { flush(); out.push({ t: 'h', level: m[1].length, text: m[2] }); continue }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); out.push({ t: 'hr' }); continue }
    if ((m = /^>\s?(.*)$/.exec(line))) { flush(); out.push({ t: 'quote', text: m[1] }); continue }
    if ((m = /^\s*[-*+]\s+(.*)$/.exec(line))) { flush(); out.push({ t: 'li', ordered: false, n: 0, text: m[1] }); continue }
    if ((m = /^\s*(\d+)[.)]\s+(.*)$/.exec(line))) { flush(); out.push({ t: 'li', ordered: true, n: Number(m[1]), text: m[2] }); continue }
    para.push(line.trim())
  }
  flush()
  return out
}

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s<>()[\]"'`]+[^\s<>()[\]"'`.,;:!?]|#[\wͰ-Ͽἀ-῿]+)/g

function Inline({ text }: { text: string }) {
  const { c } = useTheme()
  const parts: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(INLINE)) {
    const tok = m[0]
    // A #tag only counts at the start or after a space (checked by hand: no lookbehind, Hermes-safe).
    if (tok.startsWith('#') && m.index! > 0 && !/\s/.test(text[m.index! - 1])) continue
    if (m.index! > last) parts.push(text.slice(last, m.index))
    const k = parts.length
    if (tok.startsWith('**') || tok.startsWith('__')) parts.push(<Text key={k} style={{ fontFamily: F.serifMedium }}>{tok.slice(2, -2)}</Text>)
    else if (tok.startsWith('`')) parts.push(<Text key={k} style={{ fontFamily: F.mono, fontSize: 14, color: c.paperDim, backgroundColor: c.inkSurface }}> {tok.slice(1, -1)} </Text>)
    else if (tok.startsWith('[')) {
      const [, label, href] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok) ?? []
      parts.push(<Text key={k} style={{ color: c.accentLight, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(href)}>{label}</Text>)
    } else if (/^https?:/.test(tok)) {
      parts.push(<Text key={k} style={{ color: c.accentLight, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(tok)}>{tok}</Text>)
    } else if (tok.startsWith('#')) parts.push(<Text key={k} style={{ fontFamily: F.mono, fontSize: 13, color: alpha(c.accentLight, 0.8) }}>{tok}</Text>)
    else parts.push(<Text key={k} style={{ fontFamily: F.serifItalic }}>{tok.slice(1, -1)}</Text>)
    last = m.index! + tok.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

export const Markdown = memo(function Markdown({ text, size = 18 }: { text: string; size?: number }) {
  const { c, read } = useTheme()
  const base = { fontFamily: read, fontSize: size, lineHeight: size * 1.65, color: c.paper }
  return (
    <View>
      {blocks(text).map((b, i) => {
        const links = b.t === 'p' || b.t === 'li' || b.t === 'quote' ? urlsIn(b.text) : []
        const body = (() => { switch (b.t) {
          case 'h':
            return <Text key={i} style={{ ...base, fontFamily: F.serifMedium, fontSize: size * (b.level === 1 ? 1.5 : b.level === 2 ? 1.28 : 1.1), lineHeight: size * 1.9, marginTop: i ? 14 : 0, marginBottom: 4 }}><Inline text={b.text} /></Text>
          case 'quote':
            return <View key={i} style={{ borderLeftWidth: 2, borderLeftColor: alpha(c.accentLight, 0.6), paddingLeft: 14, marginVertical: 8 }}><Text style={{ ...base, fontFamily: F.serifItalic, color: c.paperDim }}><Inline text={b.text} /></Text></View>
          case 'li':
            return (
              <View key={i} style={{ flexDirection: 'row', marginVertical: 2, paddingLeft: 4 }}>
                <Text style={{ ...base, width: 22, color: b.ordered ? c.paperDimmer : c.accentLight }}>{b.ordered ? `${b.n}.` : '•'}</Text>
                <Text style={{ ...base, flex: 1 }}><Inline text={b.text} /></Text>
              </View>
            )
          case 'code':
            return <View key={i} style={{ backgroundColor: c.inkSurface, borderRadius: 12, padding: 14, marginVertical: 8 }}><Text style={{ fontFamily: F.mono, fontSize: 13, lineHeight: 20, color: c.paperDim }}>{b.text}</Text></View>
          case 'img':
            return /^https?:/.test(b.src)
              ? <Image key={i} source={{ uri: b.src }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 18, marginVertical: 8 }} resizeMode="contain" />
              : <RevealImage key={i} name={b.src} visible />
          case 'table':
            return (
              <ScrollView key={i} horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
                <View style={{ borderRadius: 12, borderWidth: 1, borderColor: c.inkSurface2, overflow: 'hidden' }}>
                  {b.rows.map((row, r) => (
                    <View key={r} style={{ flexDirection: 'row', backgroundColor: r === 0 ? c.inkSurface : 'transparent', borderTopWidth: r ? 1 : 0, borderTopColor: c.inkSurface2 }}>
                      {row.map((cell, ci) => (
                        <View key={ci} style={{ minWidth: 96, maxWidth: 220, paddingHorizontal: 12, paddingVertical: 8, borderLeftWidth: ci ? 1 : 0, borderLeftColor: c.inkSurface2 }}>
                          <Text style={{ ...base, fontSize: size * 0.85, lineHeight: size * 1.3, fontFamily: r === 0 ? F.serifMedium : read }}><Inline text={cell} /></Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            )
          case 'hr':
            return <View key={i} style={{ alignSelf: 'center', width: 56, height: 1, backgroundColor: c.inkSurface2, marginVertical: 18 }} />
          default:
            return <Text key={i} style={{ ...base, marginVertical: 6 }}><Inline text={b.text} /></Text>
        } })()
        return links.length ? <View key={i}>{body}<LinkCards urls={links} /></View> : body
      })}
    </View>
  )
})
