// The journal. One continuous read: no marks between fragments, a little air,
// and a quiet date in the margin when the day changes. Search a #tag for that
// tag's notebook; leave it empty for your main one.
//
//   swipe left   → delete (asks first)
//   swipe right  → detach; tap a "place here" gap to put it back elsewhere
//   long-press   → edit, move, take out of the read

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { excerpt, type Note } from '@grail/core'
import { Empty, Header, IconButton, Press, Row, s } from '../ui'
import { alpha, F, useTheme } from '../theme'
import { Icon } from '../icons'
import { Markdown } from '../markdown'
import { ImageViewer, RevealImage, prefetchAspects, type Opened } from '../images'
import { SwipeRow } from '../swipe'
import { EASE_OUT, sheetIn } from '../motion'
import type { ReviewTemplate } from '../data'

const dayKey = (t: number) => new Date(t).toDateString()
const dayLabel = (t: number) => {
  const d = new Date(t)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}
const listMotion = LinearTransition.duration(200).easing(EASE_OUT)

export function ReadScreen({ notebook, onNotebook, tags, notes, template, header, onBack, onEdit, onMove, onRemove, onDelete, onPlace, onExport }: {
  notebook: string | null
  onNotebook?: (tag: string | null) => void
  tags: { name: string; count: number }[]
  notes: Note[]
  template: ReviewTemplate
  header?: React.ReactNode
  onBack?: () => void
  onEdit: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
  onRemove: (id: string) => void
  onDelete: (id: string) => void
  onPlace: (id: string, index: number) => void
  onExport: (kind: 'md' | 'pdf') => void
}) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const [menu, setMenu] = useState<Note | null>(null)
  const [exporting, setExporting] = useState(false)
  const [detached, setDetached] = useState<Note | null>(null)
  const [opened, setOpened] = useState<Opened | null>(null)
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set())
  const [q, setQ] = useState(notebook ? `#${notebook}` : '')
  const [focus, setFocus] = useState(false)

  // Keep the field in step when the notebook changes from elsewhere.
  const [shownBook, setShownBook] = useState(notebook)
  if (shownBook !== notebook) { setShownBook(notebook); setQ(notebook ? `#${notebook}` : '') }

  const data = useMemo(() => (detached ? notes.filter((n) => n.id !== detached.id) : notes), [notes, detached])
  useEffect(() => { prefetchAspects(notes.map((n) => n.drawingPath ?? n.mediaPath).filter((x): x is string => !!x)) }, [notes])

  // Reveal images as they scroll into view (once).
  const onViewable = useRef(({ viewableItems }: { viewableItems: { item: Note }[] }) => {
    setRevealed((prev) => {
      let next: Set<string> | null = null
      for (const v of viewableItems) {
        if (v.item && !prev.has(v.item.id)) { next ??= new Set(prev); next.add(v.item.id) }
      }
      return next ?? prev
    })
  }).current

  const term = q.replace(/^#/, '').trim().toLowerCase()
  const suggestions = useMemo(() => tags.filter((t) => !term || t.name.includes(term)).slice(0, 12), [tags, term])
  const choose = (tag: string | null) => { onNotebook?.(tag); setQ(tag ? `#${tag}` : ''); setFocus(false) }

  const askDelete = (n: Note) => {
    Alert.alert('Delete this fragment?', `${excerpt(n.body, 80) || n.title}\n\nIt moves to #deleted: hidden everywhere, but search #deleted to find it again.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(n.id) },
    ])
  }
  const detach = (n: Note) => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setDetached(n) }
  const placeAt = (i: number) => {
    if (!detached) return
    void Haptics.selectionAsync()
    onPlace(detached.id, i)
    setDetached(null)
  }

  const Gap = ({ index }: { index: number }) => (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)}>
      <Pressable onPress={() => placeAt(index)} style={({ pressed }) => [{ marginVertical: 6, height: 40, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: alpha(c.accentLight, pressed ? 0.9 : 0.5), backgroundColor: alpha(c.accent, pressed ? 0.18 : 0.08), alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontFamily: F.sansMedium, fontSize: 12.5, color: c.accentLight }}>place here</Text>
      </Pressable>
    </Animated.View>
  )

  const renderItem = useCallback(({ item, index }: { item: Note; index: number }) => {
    const prev = data[index - 1]
    const newDay = !prev || dayKey(prev.created) !== dayKey(item.created)
    const pic = item.drawingPath ?? item.mediaPath
    const card = template === 'cards'
    return (
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(180)}>
        {detached && <Gap index={index} />}
        {newDay && (
          <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: alpha(c.accentLight, 0.85), marginTop: index === 0 ? 4 : 18, marginBottom: 8, marginLeft: -10 }}>
            {dayLabel(item.created)}
          </Text>
        )}
        <SwipeRow onLeft={() => askDelete(item)} onRight={() => detach(item)}>
          <Pressable
            onLongPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMenu(item) }}
            delayLongPress={380}
            style={({ pressed }) => [card ? { backgroundColor: c.inkSurface, borderRadius: 20, padding: 18 } : { paddingVertical: 2 }, pressed ? { opacity: 0.88 } : null]}
          >
            {pic ? <RevealImage name={pic} visible={revealed.has(item.id)} onOpen={setOpened} /> : null}
            {item.body ? <Markdown text={item.body} /> : null}
          </Pressable>
        </SwipeRow>
        <View style={{ height: card ? 14 : 22 }} />
      </Animated.View>
    )
  }, [data, template, detached, revealed, c]) // eslint-disable-line react-hooks/exhaustive-deps

  const idx = menu ? notes.findIndex((n) => n.id === menu.id) : -1
  const closeMenu = () => setMenu(null)

  return (
    <View style={{ flex: 1, backgroundColor: c.ink }}>
      <Header
        title={notebook ? `#${notebook}` : 'Read'}
        sub={`${notes.length} ${notes.length === 1 ? 'fragment' : 'fragments'}${notebook ? ' · tag notebook' : ''}`}
        onBack={onBack}
        right={<>
          {notes.length > 0 && <IconButton onPress={() => setExporting(true)} label="Save a snapshot"><Icon.download color={c.paperDim} /></IconButton>}
          {header}
        </>}
      />

      {onNotebook && (
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <View style={[s.row, { backgroundColor: c.inkSurface, borderRadius: 18, paddingLeft: 14, paddingRight: 4, gap: 8 }]}>
            <Icon.hash color={notebook ? c.accentLight : c.paperDimmer} size={18} />
            <TextInput
              value={q} onChangeText={setQ} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
              onSubmitEditing={() => { const hit = tags.find((t) => t.name === term); choose(hit ? hit.name : null) }}
              placeholder="Notebook — type a #tag, or leave empty" placeholderTextColor={c.paperDimmer}
              autoCapitalize="none" autoCorrect={false} returnKeyType="search" selectionColor={alpha(c.accentLight, 0.5)}
              style={{ flex: 1, fontFamily: F.mono, fontSize: 14, color: c.paper, paddingVertical: 11 }}
            />
            {(q || notebook) ? <IconButton onPress={() => choose(null)} label="Back to your main notebook"><Icon.close color={c.paperDimmer} size={16} /></IconButton> : null}
          </View>
          {focus && suggestions.length > 0 && (
            <Animated.View entering={FadeIn.duration(150)}>
              <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 8 }}>
                {suggestions.map((t) => (
                  <Press key={t.name} onPress={() => choose(t.name)} style={{ backgroundColor: notebook === t.name ? c.accent : c.inkSurface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 12.5, color: notebook === t.name ? c.onAccent : c.paperDim }}>#{t.name} <Text style={{ opacity: 0.6 }}>{t.count}</Text></Text>
                  </Press>
                ))}
              </ScrollView>
            </Animated.View>
          )}
        </View>
      )}

      <Animated.FlatList
        data={data}
        keyExtractor={(n) => n.id}
        renderItem={renderItem}
        itemLayoutAnimation={listMotion}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 8 }}
        contentContainerStyle={{ paddingLeft: 30, paddingRight: 20, paddingTop: 6, paddingBottom: detached ? 200 : 140 }}
        initialNumToRender={6}
        windowSize={9}
        ListFooterComponent={detached ? <Gap index={data.length} /> : undefined}
        ListEmptyComponent={<Empty icon={<Icon.read color={c.accentLight} />} title={notebook ? `Nothing in #${notebook} yet` : 'Nothing to read yet'}>
          {notebook ? 'Fragments tagged with it gather here.' : 'Fragments that keep their date-and-time title gather here into one continuous read.'}
        </Empty>}
      />

      {/* The detached fragment, waiting for a place. */}
      {detached && (
        <Animated.View entering={sheetIn} exiting={FadeOut.duration(150)}
          style={{ position: 'absolute', left: 14, right: 14, bottom: 16, backgroundColor: c.inkSurface2, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 10, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }}>
          <Icon.chapters color={c.accentLight} size={20} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: F.serif, fontSize: 16, color: c.paper }}>{excerpt(detached.body, 60) || detached.title}</Text>
            <Text style={{ fontFamily: F.sans, fontSize: 12, color: c.paperDimmer }}>Tap a “place here” gap to put it there</Text>
          </View>
          <IconButton onPress={() => setDetached(null)} label="Put it back where it was"><Icon.close color={c.paperDim} size={18} /></IconButton>
        </Animated.View>
      )}

      <ImageViewer opened={opened} onClose={() => setOpened(null)} />

      <Modal visible={!!menu} transparent animationType="none" onRequestClose={closeMenu} statusBarTranslucent>
        <Pressable onPress={closeMenu} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <Animated.View entering={sheetIn} style={{ backgroundColor: c.inkSurface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingBottom: insets.bottom + 12 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.inkSurface2, marginBottom: 8 }} />
            <Row icon={<Icon.pen color={c.accentLight} />} title="Edit" onPress={() => { onEdit(menu!.id); closeMenu() }} />
            {idx > 0 && <Row icon={<Icon.chevronUp color={c.accentLight} />} title="Move up" onPress={() => { onMove(menu!.id, -1); closeMenu() }} />}
            {idx >= 0 && idx < notes.length - 1 && <Row icon={<Icon.chevronDown color={c.accentLight} />} title="Move down" onPress={() => { onMove(menu!.id, 1); closeMenu() }} />}
            <Row icon={<Icon.chapters color={c.accentLight} />} title="Move somewhere else" hint="Same as swiping right" onPress={() => { const n = menu!; closeMenu(); detach(n) }} />
            <Row icon={<Icon.close color="#f87171" />} title="Take out of the read" hint="It stays in Browse." onPress={() => { onRemove(menu!.id); closeMenu() }} />
          </Animated.View>
        </Pressable>
      </Modal>

      <Modal visible={exporting} transparent animationType="none" onRequestClose={() => setExporting(false)} statusBarTranslucent>
        <Pressable onPress={() => setExporting(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <Animated.View entering={sheetIn} style={{ backgroundColor: c.inkSurface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingBottom: insets.bottom + 12 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.inkSurface2, marginBottom: 8 }} />
            <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: c.paperDimmer, paddingHorizontal: 16, paddingBottom: 4 }}>
              Snapshot of {notebook ? `#${notebook}` : 'your notebook'}
            </Text>
            <Row icon={<Icon.pen color={c.accentLight} />} title="Save as a note (.md)" hint="The whole read as one markdown note, kept in your notes." onPress={() => { setExporting(false); onExport('md') }} />
            <Row icon={<Icon.download color={c.accentLight} />} title="Save as PDF" hint="A typeset copy kept in your notes; opens in your PDF viewer." onPress={() => { setExporting(false); onExport('pdf') }} />
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  )
}
