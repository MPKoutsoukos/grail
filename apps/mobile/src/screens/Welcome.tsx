// First start: a short tour, then where the notes live (grail's own folder, or one the person picks,
// new or already full of notes), then a confirmation that says which folder is in use.
// Settings opens the tour again (tourOnly) and the folder choice on its own (HomeScreen).

import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInRight } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, Divider, Header, Press, Row, s } from '../ui'
import { alpha, F, useTheme } from '../theme'
import { Icon, Wordmark } from '../icons'
import type { Data } from '../data'
import { countNotes, folderLabel, pickFolder, type HomeFolder } from '../store'

const TOUR: { icon: keyof typeof Icon; title: string; text: string }[] = [
  { icon: 'pen', title: 'Write it down', text: 'Tap + for a new note: a thought, a drawing, a picture. Every note is dated, so it needs no title and no place. Keep it messy.' },
  { icon: 'read', title: 'Read it back', text: 'Read gathers your dated notes into one continuous text, oldest first, so a month of scraps reads like a draft. Long-press a fragment to edit it, move it or take it out of the read.' },
  { icon: 'hash', title: 'Tag to gather', text: 'Write #ideas, #book or any #word in a note. Tags lists them, and each tag is its own notebook with its own read.' },
  { icon: 'doc', title: 'Plain files, yours', text: 'Every note is a plain markdown file in a folder. Any app can open it, and you can back it up or move it. Next: which folder.' },
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

export function WelcomeScreen({ data, tourOnly, onDone }: { data: Data; tourOnly?: boolean; onDone?: () => void }) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState(0)
  const last = TOUR.length - 1
  const finishTour = () => (tourOnly ? onDone?.() : setStep(TOUR.length))

  if (step >= TOUR.length) {
    return <FolderStep data={data} first onDone={() => data.finishWelcome()} onBack={() => setStep(last)} />
  }
  const t = TOUR[step]
  const Glyph = Icon[t.icon]
  return (
    <View style={{ flex: 1, backgroundColor: c.ink, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16, paddingHorizontal: 24 }}>
      <View style={[s.row, { justifyContent: 'space-between', height: 44 }]}>
        <Wordmark size={26} color={c.accentLight} />
        <Press onPress={finishTour} style={{ padding: 10 }}>
          <Text style={{ fontFamily: F.sans, fontSize: 14, color: c.paperDimmer }}>{tourOnly ? 'Close' : 'Skip'}</Text>
        </Press>
      </View>
      <Animated.View key={step} entering={FadeInRight.duration(260)} style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: alpha(c.accent, 0.16), alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
          <Glyph color={c.accentLight} size={32} />
        </View>
        <Text style={{ fontFamily: F.serif, fontSize: 34, lineHeight: 40, color: c.paper, marginBottom: 14 }}>{t.title}</Text>
        <Text style={{ fontFamily: F.sans, fontSize: 16.5, lineHeight: 26, color: c.paperDim }}>{t.text}</Text>
      </Animated.View>
      <Dots n={TOUR.length} at={step} />
      <View style={[s.row, { gap: 10, marginTop: 20 }]}>
        {step > 0 && <View style={{ flex: 1 }}><Button kind="quiet" title="Back" onPress={() => setStep(step - 1)} /></View>}
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
