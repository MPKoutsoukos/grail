// First start: a short tour, then where the notes live (grail's own folder, or one the person picks,
// new or already full of notes), then a confirmation that says which folder is in use.
// Settings opens the tour again (tourOnly) and the folder choice on its own (HomeScreen).

import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown, FadeInRight, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, Divider, Eyebrow, Header, Press, Row, s } from '../ui'
import { alpha, F, useTheme } from '../theme'
import { Icon, Wordmark } from '../icons'
import type { Data } from '../data'
import { countNotes, folderLabel, pickFolder, type HomeFolder } from '../store'

// ---- the tour: each step shows a small moving picture of the real screen, and one line -----------

const SAMPLE = 'The bus idea: a map of every stop, drawn from memory. #book'
const stamp = () => {
  const d = new Date(), p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Counts up 0..n, one every `ms` (looping back to 0 if `loop`): the pictures play out step by step. */
function useReveal(n: number, ms: number, startAfter = 250, loop = false) {
  const [k, setK] = useState(0)
  useEffect(() => {
    let i = 0
    let t: ReturnType<typeof setInterval> | undefined
    const s0 = setTimeout(() => {
      t = setInterval(() => {
        i = loop && i >= n ? 0 : i + 1
        setK(i)
        if (!loop && i >= n && t) clearInterval(t)
      }, ms)
    }, startAfter)
    return () => { clearTimeout(s0); if (t) clearInterval(t) }
  }, [n, ms, startAfter, loop])
  return k
}

function Mock({ children }: { children: React.ReactNode }) {
  const { c } = useTheme()
  return <View style={{ backgroundColor: c.inkSurface, borderRadius: 22, padding: 18, gap: 10, minHeight: 240, justifyContent: 'center', overflow: 'hidden' }}>{children}</View>
}

/** 1. A new note, typing itself. */
function WriteArt() {
  const { c, read } = useTheme()
  const n = useReveal(SAMPLE.length, 45, 400)
  const typed = SAMPLE.slice(0, n)
  const tag = typed.indexOf('#book')
  return (
    <Mock>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <Text style={{ fontFamily: F.serif, fontSize: 19, color: c.paper }}>{stamp()}</Text>
        <View style={[s.row, { gap: 5, backgroundColor: c.accent, borderRadius: 10, paddingHorizontal: 9, height: 26 }]}>
          <Icon.check color={c.onAccent} size={13} strokeWidth={2.5} />
          <Text style={{ fontFamily: F.sansSemi, fontSize: 12, color: c.onAccent }}>Done</Text>
        </View>
      </View>
      <View style={[s.row, { alignSelf: 'flex-start', gap: 5, backgroundColor: c.ink, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }]}>
        <Icon.read size={11} color={c.accentLight} />
        <Text style={{ fontFamily: F.sans, fontSize: 11, color: c.paperDimmer }}>Gathered into Read</Text>
      </View>
      <Text style={{ fontFamily: read, fontSize: 18, lineHeight: 28, color: c.paper, minHeight: 84 }}>
        {tag >= 0 ? <>{typed.slice(0, tag)}<Text style={{ color: c.accentLight }}>{typed.slice(tag)}</Text></> : typed}
        <Text style={{ color: c.accentLight }}>▍</Text>
      </Text>
    </Mock>
  )
}

/** 2. Scattered notes, stitched into one read. */
const FRAGMENTS = [
  { day: '3 Nov', text: 'Saw a fox on the platform at six, unhurried, like it had a ticket.' },
  { day: '', text: 'The bus idea: a map of every stop, drawn from memory.' },
  { day: '12 Nov', text: 'Maybe the map is the book. Each stop, one chapter.' },
]
function ReadArt() {
  const { c, read } = useTheme()
  const k = useReveal(FRAGMENTS.length, 650)
  return (
    <Mock>
      <Eyebrow style={{ marginBottom: 2 }}>Read</Eyebrow>
      {FRAGMENTS.map((f, i) => i < k && (
        <Animated.View key={i} entering={FadeInDown.duration(380)} style={[s.row, { alignItems: 'flex-start', gap: 10 }]}>
          <Text style={{ width: 44, fontFamily: F.sans, fontSize: 11, lineHeight: 26, color: c.accentLight }}>{f.day}</Text>
          <Text style={{ flex: 1, fontFamily: read, fontSize: 16.5, lineHeight: 26, color: c.paper }}>{f.text}</Text>
        </Animated.View>
      ))}
    </Mock>
  )
}

/**
 * 3. Shaping the read, as a loop: swipe left (to #deleted), swipe right (pick up, place elsewhere),
 * long-press (edit, move, take out).
 */
const SHAPE = ['Saw a fox on the platform at six.', 'A map of every stop.', 'Each stop, one chapter.']
const STAGES = [
  { row: -1, dx: 0, hint: '' },
  { row: 0, dx: -96, hint: 'Swipe left: delete (to #deleted)' },
  { row: -1, dx: 0, hint: '' },
  { row: 2, dx: 96, hint: 'Swipe right: pick it up, then tap a gap to place it' },
  { row: -1, dx: 0, hint: '' },
  { row: 1, dx: 0, hint: 'Long-press: edit, move up or down, or take it out of the read' },
]
function ShapeRow({ text, dx, pressed, swipe }: { text: string; dx: number; pressed: boolean; swipe: 'left' | 'right' | null }) {
  const { c, read } = useTheme()
  const x = useSharedValue(0)
  const sc = useSharedValue(1)
  useEffect(() => { x.value = withTiming(dx, { duration: 420 }) }, [dx, x])
  useEffect(() => { sc.value = withTiming(pressed ? 0.96 : 1, { duration: 260 }) }, [pressed, sc])
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { scale: sc.value }] }))
  return (
    <View style={{ borderRadius: 14, overflow: 'hidden' }}>
      <View style={[s.row, { position: 'absolute', inset: 0, paddingHorizontal: 16, justifyContent: swipe === 'right' ? 'flex-start' : 'flex-end',
        backgroundColor: swipe === 'left' ? '#7f1d1d' : swipe === 'right' ? alpha(c.accent, 0.5) : 'transparent' }]}>
        {swipe === 'left' && <Icon.trash color="#fecaca" size={18} />}
        {swipe === 'right' && <Icon.chapters color={c.paper} size={18} />}
      </View>
      <Animated.View style={[st, { backgroundColor: pressed ? c.inkSurface2 : c.ink, paddingHorizontal: 14, paddingVertical: 11 }]}>
        <Text style={{ fontFamily: read, fontSize: 15.5, color: c.paper }}>{text}</Text>
      </Animated.View>
    </View>
  )
}
function ShapeArt() {
  const { c } = useTheme()
  const k = useReveal(STAGES.length - 1, 1300, 500, true)
  const st = STAGES[k]
  return (
    <Mock>
      {SHAPE.map((t, i) => (
        <ShapeRow key={t} text={t} dx={st.row === i ? st.dx : 0} pressed={st.row === i && st.dx === 0}
          swipe={st.row === i ? (st.dx < 0 ? 'left' : st.dx > 0 ? 'right' : null) : null} />
      ))}
      <Text style={{ fontFamily: F.sansMedium, fontSize: 13, lineHeight: 19, color: c.accentLight, minHeight: 38, marginTop: 4 }}>{st.hint}</Text>
    </Mock>
  )
}

/** 4. A #tag lighting up the notes that carry it. */
const TAGGED = [
  { text: 'A map of every stop', book: true },
  { text: 'Call the bike shop', book: false },
  { text: 'Each stop, one chapter', book: true },
  { text: 'Tulips before the frost', book: false },
]
function TagArt() {
  const { c } = useTheme()
  const k = useReveal(2, 900, 600)
  const lit = k >= 1
  return (
    <Mock>
      {TAGGED.map((n) => (
        <View key={n.text} style={[s.row, { gap: 10, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: c.ink,
          borderWidth: 1.5, borderColor: lit && n.book ? c.accentLight : 'transparent', opacity: lit && !n.book ? 0.4 : 1 }]}>
          <Text style={{ flex: 1, fontFamily: F.sans, fontSize: 14, color: c.paper }}>{n.text}</Text>
          {n.book && <Text style={{ fontFamily: F.sans, fontSize: 12.5, color: c.accentLight }}>#book</Text>}
        </View>
      ))}
      {k >= 2 && (
        <Animated.View entering={FadeIn.duration(300)} style={[s.row, { alignSelf: 'center', gap: 6, backgroundColor: alpha(c.accent, 0.18), borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 }]}>
          <Icon.hash size={14} color={c.accentLight} />
          <Text style={{ fontFamily: F.sansMedium, fontSize: 13, color: c.accentLight }}>book · 2 notes · its own read</Text>
        </Animated.View>
      )}
    </Mock>
  )
}

/** 5. The notes as files in a folder. */
const FILES = [
  { name: '1763460120000.md', icon: 'doc' as const },
  { name: '1763461980000.md', icon: 'doc' as const },
  { name: '1763461980000-mf2k.png', icon: 'image' as const },
  { name: 'grail-settings.json', icon: 'settings' as const },
]
function FilesArt() {
  const { c } = useTheme()
  const k = useReveal(FILES.length, 420)
  return (
    <Mock>
      <View style={[s.row, { gap: 10, marginBottom: 4 }]}>
        <Icon.library color={c.accentLight} size={20} />
        <Text style={{ fontFamily: F.sansMedium, fontSize: 15, color: c.paper }}>your folder</Text>
      </View>
      {FILES.map((f, i) => {
        const G = Icon[f.icon]
        return i < k && (
          <Animated.View key={f.name} entering={FadeInRight.duration(300)} style={[s.row, { gap: 10, paddingLeft: 12 }]}>
            <G color={c.paperDimmer} size={16} />
            <Text style={{ fontFamily: F.mono, fontSize: 12.5, color: c.paperDim }}>{f.name}</Text>
          </Animated.View>
        )
      })}
    </Mock>
  )
}

const TOUR: { title: string; line: string; Art: () => React.ReactElement }[] = [
  { title: 'Write it down', line: 'Tap + and write. Every note is dated, so it needs no title and no place. Done saves it (it also saves as you type).', Art: WriteArt },
  { title: 'Read it back', line: 'Read stitches your dated notes into one text, oldest first.', Art: ReadArt },
  { title: 'Shape the read', line: 'Delete, move or take out fragments right in Read. Deleted notes wait in #deleted: search it to find them.', Art: ShapeArt },
  { title: 'Tag to gather', line: 'Write #book in any note. Each tag becomes its own notebook with its own read.', Art: TagArt },
  { title: 'Plain files, yours', line: 'Every note is a markdown file in a folder you choose. Next: which one.', Art: FilesArt },
]

function Dots({ n, at }: { n: number; at: number }) {
  const { c } = useTheme()
  return (
    <View style={[s.row, { gap: 6, justifyContent: 'center' }]}>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={{ width: i === at ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === at ? c.accentLight : c.inkSurface2 }} />
      ))}
    </View>
  )
}

/** The very first screen: what grail is, then the tour or straight on to the folder. */
function WelcomePanel({ onTour, onSkip }: { onTour: () => void; onSkip: () => void }) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const ideas = ['One place for every idea', 'Catch it the moment it arrives', 'Read it back as one story']
  return (
    <View style={{ flex: 1, backgroundColor: c.ink, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16, paddingHorizontal: 28 }}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Animated.View entering={FadeIn.duration(500)}>
          <Wordmark size={64} color={c.accentLight} />
        </Animated.View>
        <Animated.Text entering={FadeInDown.delay(250).duration(450)}
          style={{ fontFamily: F.serif, fontSize: 38, lineHeight: 44, color: c.paper, marginTop: 18 }}>
          Welcome to your grail diary.
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(450).duration(450)}
          style={{ fontFamily: F.sans, fontSize: 16.5, lineHeight: 25, color: c.paperDim, marginTop: 12 }}>
          A notebook for catching every idea, and reading them back until the good ones add up.
        </Animated.Text>
        <View style={{ marginTop: 28, gap: 12 }}>
          {ideas.map((t, i) => (
            <Animated.View key={t} entering={FadeInDown.delay(700 + i * 160).duration(400)} style={[s.row, { gap: 12 }]}>
              <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: alpha(c.accent, 0.18), alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: c.accentLight }}>{i + 1}</Text>
              </View>
              <Text style={{ fontFamily: F.sansMedium, fontSize: 15.5, color: c.paper }}>{t}</Text>
            </Animated.View>
          ))}
        </View>
      </View>
      <Animated.View entering={FadeIn.delay(1100).duration(400)} style={{ gap: 10 }}>
        <Button title="Show me around" onPress={onTour} />
        <Button kind="quiet" title="Skip the tour" onPress={onSkip} />
        <Text style={{ fontFamily: F.sans, fontSize: 12, color: c.paperDimmer, textAlign: 'center', marginTop: 6 }}>
          Free and open source. No account, no ads, no tracking.
        </Text>
      </Animated.View>
    </View>
  )
}

export function WelcomeScreen({ data, tourOnly, onDone }: { data: Data; tourOnly?: boolean; onDone?: () => void }) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  // -1: the welcome panel (first start only), 0..last: the tour, past last: the folder choice
  const [step, setStep] = useState(tourOnly ? 0 : -1)
  const last = TOUR.length - 1
  const finishTour = () => (tourOnly ? onDone?.() : setStep(TOUR.length))

  if (step >= TOUR.length) {
    return <FolderStep data={data} first onDone={() => data.finishWelcome()} onBack={() => setStep(last)} />
  }
  if (step < 0) return <WelcomePanel onTour={() => setStep(0)} onSkip={() => setStep(TOUR.length)} />
  const t = TOUR[step]
  return (
    <View style={{ flex: 1, backgroundColor: c.ink, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16, paddingHorizontal: 24 }}>
      <View style={[s.row, { justifyContent: 'space-between', height: 44 }]}>
        <Wordmark size={26} color={c.accentLight} />
        <Press onPress={finishTour} style={{ padding: 10 }}>
          <Text style={{ fontFamily: F.sans, fontSize: 14, color: c.paperDimmer }}>{tourOnly ? 'Close' : 'Skip'}</Text>
        </Press>
      </View>
      <Animated.View key={step} entering={FadeInRight.duration(260)} style={{ flex: 1, justifyContent: 'center', gap: 28 }}>
        <t.Art />
        <View>
          <Text style={{ fontFamily: F.serif, fontSize: 32, lineHeight: 38, color: c.paper, marginBottom: 8 }}>{t.title}</Text>
          <Text style={{ fontFamily: F.sans, fontSize: 16.5, lineHeight: 25, color: c.paperDim }}>{t.line}</Text>
        </View>
      </Animated.View>
      <Dots n={TOUR.length} at={step} />
      <View style={[s.row, { gap: 10, marginTop: 20 }]}>
        {(step > 0 || !tourOnly) && <View style={{ flex: 1 }}><Button kind="quiet" title="Back" onPress={() => setStep(step - 1)} /></View>}
        <View style={{ flex: 2 }}>
          <Button title={step === last ? (tourOnly ? 'Done' : 'Choose a folder') : 'Next'} onPress={() => (step === last ? finishTour() : setStep(step + 1))} />
        </View>
      </View>
    </View>
  )
}

/** Settings → Home folder; also shown on start when the folder can't be opened any more (no way back then). */
export function HomeScreen({ data, onBack }: { data: Data; onBack?: () => void }) {
  return <FolderStep data={data} onDone={() => onBack?.()} onBack={onBack} />
}

function FolderStep({ data, first, onDone, onBack }: { data: Data; first?: boolean; onDone: () => void; onBack?: () => void }) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const [chosen, setChosen] = useState(false) // a choice was made: show which folder is in use
  const [busy, setBusy] = useState(false)

  const use = async (next: HomeFolder) => {
    const same = next.kind === data.folder.kind && (next.kind === 'app' || (data.folder.kind === 'folder' && next.uri === data.folder.uri))
    if (same) { setChosen(true); return }
    // Changing homes with notes already written: offer to bring them along.
    const bring = !first && data.notes.length > 0
      ? await new Promise<boolean | null>((resolve) => Alert.alert(
        'Bring your notes along?',
        `Copy your ${data.notes.length} notes into the new folder, or start there with what it already has? The old folder stays as it is either way.`,
        [{ text: 'Cancel', style: 'cancel', onPress: () => resolve(null) }, { text: 'Don’t copy', onPress: () => resolve(false) }, { text: 'Copy them', onPress: () => resolve(true) }],
        { cancelable: true, onDismiss: () => resolve(null) },
      ))
      : false
    if (bring === null) return
    setBusy(true)
    try {
      await data.setFolder(next, bring)
      setChosen(true)
    } catch (e) {
      Alert.alert('Couldn’t use that folder', e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }
  const pick = async () => { const h = await pickFolder(); if (h) await use(h) }

  if (chosen && !busy) return <Chosen data={data} first={first} onDone={onDone} onAgain={() => setChosen(false)} />

  const option = (icon: React.ReactNode, title: string, hint: string, onPress: () => void, primary?: boolean) => (
    <Press onPress={onPress} disabled={busy} haptic
      style={{ borderRadius: 20, padding: 18, backgroundColor: c.inkSurface, borderWidth: 2, borderColor: primary ? alpha(c.accentLight, 0.5) : 'transparent', gap: 6 }}>
      <View style={[s.row, { gap: 10 }]}>{icon}<Text style={{ fontFamily: F.sansSemi, fontSize: 16, color: c.paper }}>{title}</Text></View>
      <Text style={{ fontFamily: F.sans, fontSize: 13.5, lineHeight: 20, color: c.paperDim }}>{hint}</Text>
    </Press>
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.ink }}>
      <Header title={first ? '' : 'Home folder'} onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 14 }}>
        <Animated.View entering={FadeIn.duration(240)} style={{ gap: 10, marginBottom: 8 }}>
          <Text style={{ fontFamily: F.serif, fontSize: 30, lineHeight: 36, color: c.paper }}>Where should your notes live?</Text>
          <Text style={{ fontFamily: F.sans, fontSize: 14.5, lineHeight: 22, color: c.paperDim }}>
            {first
              ? 'grail keeps every note as a file in one folder, its home. You can change it later in Settings.'
              : `Now: ${folderLabel(data.folder).title}. Notes, tags, Read’s order and settings belong to a folder, so another folder has its own.`}
          </Text>
          {data.folderError && !first && (
            <Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 21, color: '#f87171' }}>
              grail can’t open that folder any more (it may have been moved or deleted). Choose it again, or another one.
            </Text>
          )}
        </Animated.View>
        {option(<Icon.check color={c.accentLight} size={20} />, first ? 'Use grail’s folder (the default)' : 'grail’s own folder',
          'Inside the app on this phone. Nothing to set up; but uninstalling grail deletes it, so keep snapshots somewhere safe.',
          () => void use({ kind: 'app' }), first)}
        {option(<Icon.library color={c.paperDim} size={20} />, 'Choose a folder',
          'A new folder, or one that already has your notes: markdown files from grail on a computer, or from another app. Android asks you to allow grail into that folder only.',
          () => void pick())}
        {busy && <ActivityIndicator color={c.accentLight} style={{ marginTop: 12 }} />}
      </ScrollView>
    </View>
  )
}

function Chosen({ data, first, onDone, onAgain }: { data: Data; first?: boolean; onDone: () => void; onAgain: () => void }) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const [count, setCount] = useState<{ notes: number; plain: number } | null>(null)
  useEffect(() => {
    if (data.loading || !data.home) return
    let cancelled = false
    countNotes(data.home.store).then((r) => { if (!cancelled) setCount(r) }).catch(() => { if (!cancelled) setCount({ notes: data.notes.length, plain: 0 }) })
    return () => { cancelled = true }
  }, [data.loading, data.home, data.notes.length])
  const label = folderLabel(data.folder)
  const found = !count ? 'Looking inside…'
    : count.notes === 0 ? 'Empty so far: your new notes go here.'
    : `Found ${count.notes} ${count.notes === 1 ? 'note' : 'notes'}.`
  return (
    <View style={{ flex: 1, backgroundColor: c.ink, paddingTop: insets.top + 56, paddingBottom: insets.bottom + 16, paddingHorizontal: 20 }}>
      <Animated.View entering={FadeIn.duration(260)} style={{ flex: 1, gap: 14 }}>
        <Text style={{ fontFamily: F.serif, fontSize: 30, lineHeight: 36, color: c.paper }}>Your notes are here</Text>
        <Card>
          <Row icon={<Icon.library color={c.accentLight} />} title={label.title} hint={label.detail} />
          <Divider />
          <Row icon={data.folderError ? <Icon.alert color="#f87171" /> : <Icon.doc color={c.paperDim} />}
            title={data.folderError ? 'grail can’t open this folder' : found}
            hint={data.folderError ?? (count && count.plain > 0
              ? `${count.plain} of them are plain markdown from elsewhere. They show in Browse and under their #tags; Read gathers grail’s dated notes.`
              : undefined)} />
        </Card>
        <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 20, color: c.paperDimmer }}>
          Settings → Home folder always shows where your notes are, and lets you change it.
        </Text>
      </Animated.View>
      <View style={{ gap: 10 }}>
        <Button title={first ? 'Start writing' : 'Done'} onPress={onDone} disabled={!!data.folderError || data.loading} />
        <Button kind="quiet" title="Choose another folder" onPress={onAgain} />
      </View>
    </View>
  )
}
