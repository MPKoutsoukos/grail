import { useCallback, useMemo, useState } from 'react'
import { FlatList, Text, View } from 'react-native'
import { categoryPool, collectCategories, isQueryActive, matchesQuery, matchesText, type Note } from '@grail/core'
import { Empty, Header, Press, SearchField, s } from '../ui'
import { alpha, F, useTheme } from '../theme'
import { Icon } from '../icons'
import { NoteRow } from './NoteRow'

export function TagsScreen({ notes, onOpen, onOpenTag, header }: {
  notes: Note[]; onOpen: (n: Note) => void; onOpenTag: (tag: string) => void; header: React.ReactNode
}) {
  const { c } = useTheme()
  const [q, setQ] = useState('')
  const cats = useMemo(() => collectCategories(notes), [notes])
  const max = Math.max(1, ...cats.map((x) => x.count))
  const active = isQueryActive(q)
  const results = useMemo(() => (active ? notes.filter((n) => matchesQuery(n, q)) : []), [notes, q, active])
  const renderNote = useCallback(({ item }: { item: Note }) => <NoteRow note={item} onOpen={onOpen} />, [onOpen])

  return (
    <View style={{ flex: 1, backgroundColor: c.ink }}>
      <Header title="Tags" sub={`${cats.length} in use`} right={header} />
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <SearchField value={q} onChange={setQ} placeholder="#npcs #lore -#draft  OR  words" mono />
      </View>
      {active ? (
        <FlatList data={results} keyExtractor={(n) => n.id} renderItem={renderNote}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}
          ListEmptyComponent={<Empty icon={<Icon.search color={c.accentLight} />} title="No matches" />} />
      ) : (
        <FlatList
          data={cats}
          keyExtractor={(x) => x.name}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140, gap: 8 }}
          renderItem={({ item }) => (
            <Press onPress={() => onOpenTag(item.name)} scale={0.985} style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: c.inkSurface }}>
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(item.count / max) * 100}%`, backgroundColor: alpha(c.accent, 0.12) }} />
              <View style={[s.row, { paddingHorizontal: 16, paddingVertical: 15, gap: 12 }]}>
                <Icon.hash color={c.accentLight} size={18} />
                <Text style={{ flex: 1, fontFamily: F.sans, fontSize: 16, color: c.paper }}>{item.name}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: c.paperDimmer }}>{item.count}</Text>
              </View>
            </Press>
          )}
          ListEmptyComponent={<Empty icon={<Icon.hash color={c.accentLight} />} title="No tags yet">Write #places anywhere in a note to start one.</Empty>}
        />
      )}
    </View>
  )
}

export function TagScreen({ tag, notes, onBack, onOpen, onRead }: {
  tag: string; notes: Note[]; onBack: () => void; onOpen: (n: Note) => void; onRead: () => void
}) {
  const { c } = useTheme()
  const [q, setQ] = useState('')
  const pool = useMemo(() => categoryPool(notes, tag), [notes, tag])
  const shown = useMemo(() => pool.filter((n) => matchesText(n, q)), [pool, q])
  const renderNote = useCallback(({ item }: { item: Note }) => <NoteRow note={item} onOpen={onOpen} />, [onOpen])
  return (
    <View style={{ flex: 1, backgroundColor: c.ink }}>
      <Header title={`#${tag}`} sub={`${pool.length} ${pool.length === 1 ? 'note' : 'notes'}`} onBack={onBack}
        right={pool.length ? (
          <Press onPress={onRead} style={[s.row, { gap: 6, backgroundColor: c.inkSurface, borderRadius: 999, paddingHorizontal: 14, height: 38, marginRight: 6 }]}>
            <Icon.read color={c.accentLight} size={18} /><Text style={{ fontFamily: F.sansMedium, color: c.accentLight }}>Read</Text>
          </Press>
        ) : null} />
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}><SearchField value={q} onChange={setQ} placeholder={`Search #${tag}`} /></View>
      <FlatList data={shown} keyExtractor={(n) => n.id} renderItem={renderNote}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}
        ListEmptyComponent={<Empty icon={<Icon.hash color={c.accentLight} />} title={pool.length ? 'Nothing matches' : 'Nothing tagged yet'} />} />
    </View>
  )
}
