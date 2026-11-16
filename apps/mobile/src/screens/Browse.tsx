import { useCallback, useMemo, useState } from 'react'
import { SectionList, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { excerpt, matchesText, noteKind, type Note } from '@grail/core'
import { Empty, Eyebrow, Header, Press, SearchField } from '../ui'
import { F, alpha, useTheme } from '../theme'
import { Icon } from '../icons'
import { EnvMark } from '../env'
import { NoteRow, ago } from './NoteRow'

// Echoes: an older fragment resurfaced, anniversaries first. Stable for the day.
function pickEcho(notes: Note[], salt: number): Note | null {
  const now = new Date()
  const old = notes.filter((n) => noteKind(n) === 'timeline' && n.body.trim() && now.getTime() - n.created > 7 * 86_400_000)
  if (!old.length) return null
  const anniversaries = old.filter((n) => new Date(n.created).getDate() === now.getDate())
  const pool = anniversaries.length ? anniversaries : old
  return pool[(Math.floor(Date.now() / 86_400_000) + salt) % pool.length]
}

function bucket(ts: number): string {
  const d = new Date(ts), now = new Date()
  const day = (x: Date) => Math.floor((x.getTime() - x.getTimezoneOffset() * 60_000) / 86_400_000)
  const diff = day(now) - day(d)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return 'This week'
  if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) return 'This month'
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function BrowseScreen({ notes, removedIds, echoes, onOpen, header }: {
  notes: Note[]; removedIds: Set<string>; echoes: boolean; onOpen: (n: Note) => void; header: React.ReactNode
}) {
  const { c } = useTheme()
  const [q, setQ] = useState('')
  const [salt, setSalt] = useState(0)
  const filtered = useMemo(() => notes.filter((n) => matchesText(n, q)), [notes, q])
  const echo = useMemo(() => (echoes && !q ? pickEcho(notes, salt) : null), [echoes, q, notes, salt])
  const sections = useMemo(() => {
    if (q) return [{ title: '', data: filtered }]
    const out: { title: string; data: Note[] }[] = []
    for (const n of [...filtered].sort((a, b) => b.updated - a.updated)) {
      const t = bucket(n.updated)
      const last = out[out.length - 1]
      if (last?.title === t) last.data.push(n)
      else out.push({ title: t, data: [n] })
    }
    return out
  }, [filtered, q])
  const renderItem = useCallback(({ item }: { item: Note }) => <NoteRow note={item} onOpen={onOpen} outOfRead={removedIds.has(item.id)} />, [onOpen, removedIds])

  return (
    <View style={{ flex: 1, backgroundColor: c.ink }}>
      <Header
        title={<EnvMark />}
        sub={`${notes.length} ${notes.length === 1 ? 'fragment' : 'fragments'}`}
        right={header}
      />
      <SectionList
        sections={sections}
        keyExtractor={(n) => n.id}
        renderItem={renderItem}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}
        initialNumToRender={12}
        windowSize={11}
        removeClippedSubviews
        ListHeaderComponent={
          <View>
            <View style={{ marginBottom: 16 }}><SearchField value={q} onChange={setQ} /></View>
            {echo && (
              <Animated.View entering={FadeIn.duration(320)}>
                <Press onPress={() => onOpen(echo)} scale={0.985} style={{ backgroundColor: c.inkSurface, borderRadius: 20, padding: 16, paddingRight: 48, marginBottom: 18 }}>
                  <Eyebrow color={c.accentLight} style={{ marginBottom: 8 }}>✦ echo · {ago(echo.created)}</Eyebrow>
                  <Text numberOfLines={3} style={{ fontFamily: F.serifItalic, fontSize: 17, lineHeight: 27, color: c.paperDim }}>“{excerpt(echo.body, 220)}”</Text>
                  <Press onPress={() => setSalt((x) => x + 1)} accessibilityLabel="Another echo" style={{ position: 'absolute', right: 6, top: 6, padding: 10 }}>
                    <Icon.shuffle color={c.paperDimmer} size={18} />
                  </Press>
                </Press>
              </Animated.View>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (section.title ? <Eyebrow style={{ marginTop: 8, marginBottom: 8, marginLeft: 4 }}>{section.title}</Eyebrow> : null)}
        ListEmptyComponent={notes.length === 0
          ? <Empty icon={<Icon.pen color={c.accentLight} />} title="An empty vessel">Tap + to write your first fragment. Everything stays in plain markdown files.</Empty>
          : <Empty icon={<Icon.search color={c.accentLight} />} title="Nothing matches">Try fewer words, or a #tag.</Empty>}
      />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 24, backgroundColor: alpha(c.ink, 0) }} />
    </View>
  )
}
