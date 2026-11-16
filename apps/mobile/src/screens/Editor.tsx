import { useEffect, useRef, useState } from 'react'
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { categoryName, noteKind, type Note } from '@grail/core'
import { Header, IconButton, Press, s } from '../ui'
import { alpha, F, useTheme } from '../theme'
import { Icon } from '../icons'
import { Markdown } from '../markdown'
import { fileUri, openInViewer } from '../store'
import { TableEditor } from './TableEditor'
import { RevealImage } from '../images'
import { editableSegments, joinSegments, tableMarkdown, emptyTable } from '../table'

type Text_ = { title: string; body: string }
const same = (a: Text_, b: Text_) => a.title === b.title && a.body === b.body
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60_000)
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`
}

const TOOLS = [
  { I: Icon.bold, t: 'Bold' }, { I: Icon.italic, t: 'Italic' }, { I: Icon.heading, t: 'Heading' },
  { I: Icon.list, t: 'List' }, { I: Icon.quote, t: 'Quote' }, { I: Icon.hash, t: 'Tag' },
  { I: Icon.table, t: 'Table' },
] as const

export function EditorScreen({ note, clash, onResolveClash, onSave, onDelete, onClose, onAttach }: {
  note: Note
  clash: { device: string; at: number } | null
  onResolveClash: (choice: 'mine' | 'theirs') => void
  onSave: (n: Note) => void
  onDelete: (id: string) => void
  onClose: () => void
  onAttach: (n: Note) => void
}) {
  const { c, read } = useTheme()
  const insets = useSafeAreaInsets()
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  // A snapshot is a copy to read, so it opens as it reads; the pen still edits it.
  const [preview, setPreview] = useState(note.type === 'snapshot' && !!note.body)
  // The cursor is native; we only steer it right after a toolbar edit.
  // The body is split into text and table segments so tables edit as grids.
  const segs = editableSegments(body)
  const sel = useRef({ i: 0, start: 0, end: 0 })
  const [forced, setForced] = useState<{ i: number; start: number; end: number } | undefined>()
  const [persisted, setPersisted] = useState<Text_>({ title: note.title, body: note.body })
  const [seen, setSeen] = useState<Text_>({ title: note.title, body: note.body })
  const [incoming, setIncoming] = useState<Text_ | null>(null)
  const [flash, setFlash] = useState(false)

  // A newer version arrived from sync while this note is open.
  const arrived = { title: note.title, body: note.body }
  if (!same(arrived, seen)) {
    setSeen(arrived)
    if (!same(arrived, persisted)) {
      if (same({ title, body }, persisted)) { setTitle(arrived.title); setBody(arrived.body); setPersisted(arrived); setFlash(true) }
      else setIncoming(arrived)
    }
  }
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(false), 2500)
    return () => clearTimeout(t)
  }, [flash])

  const dirty = !same({ title, body }, persisted)
  const paused = !!incoming || !!clash
  useEffect(() => {
    if (!dirty || paused) return
    const t = setTimeout(() => { onSave({ ...note, title, body }); setPersisted({ title, body }) }, 600)
    return () => clearTimeout(t)
  }, [title, body, dirty, paused, note, onSave])

  // Leaving never drops the last keystrokes.
  const latest = useRef({ note, title, body, dirty, onSave })
  useEffect(() => { latest.current = { note, title, body, dirty, onSave } })
  useEffect(() => () => {
    const l = latest.current
    if (l.dirty) l.onSave({ ...l.note, title: l.title, body: l.body })
  }, [])

  const setSeg = (i: number, val: string | string[][]) => {
    const next = segs.map((s, j) => (j === i ? (typeof val === 'string' ? { kind: 'text' as const, text: val } : { kind: 'table' as const, rows: val }) : s))
    setBody(joinSegments(next))
  }
  const removeSeg = (i: number) => {
    const next = segs.filter((_, j) => j !== i)
    setBody(joinSegments(next.length ? next : [{ kind: 'text', text: '' }]))
  }

  const apply = (t: (typeof TOOLS)[number]['t']) => {
    const { i, start, end } = sel.current
    const seg = segs[i]
    if (t === 'Table') {
      if (!seg || seg.kind !== 'text') return
      const table = tableMarkdown(emptyTable())
      const before = seg.text.slice(0, start)
      const after = seg.text.slice(end)
      const nl1 = before && !before.endsWith('\n') ? '\n' : ''
      const nl2 = after && !after.startsWith('\n') ? '\n' : ''
      setSeg(i, before + nl1 + table + nl2 + after)
      setForced(undefined)
      return
    }
    if (!seg || seg.kind !== 'text') return
    const picked = seg.text.slice(start, end)
    const wrap = (a: string, b = a) => { setSeg(i, seg.text.slice(0, start) + a + picked + b + seg.text.slice(end)); setForced({ i, start: start + a.length, end: end + a.length }) }
    const prefix = (p: string) => {
      const ls = seg.text.lastIndexOf('\n', start - 1) + 1
      setSeg(i, seg.text.slice(0, ls) + p + seg.text.slice(ls)); setForced({ i, start: start + p.length, end: end + p.length })
    }
    if (t === 'Bold') wrap('**')
    else if (t === 'Italic') wrap('*')
    else if (t === 'Heading') prefix('## ')
    else if (t === 'List') prefix('- ')
    else if (t === 'Quote') prefix('> ')
    else wrap('#', '')
  }

  const kind = noteKind({ ...note, title, body })
  const badge = kind === 'category' ? `Page for #${categoryName({ ...note, title, body })}` : kind === 'timeline' ? 'Gathered into Read' : 'Loose note · kept out of Read'
  const words = body.trim() ? body.trim().split(/\s+/).length : 0
  const status = flash ? 'Updated from another device' : paused ? 'Waiting for you' : dirty ? 'Saving…' : 'Saved'

  const Banner = ({ text, mine, theirs }: { text: string; mine: () => void; theirs: () => void }) => (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={{ backgroundColor: c.inkSurface, borderRadius: 18, borderWidth: 1, borderColor: alpha('#fbbf24', 0.35), padding: 14, marginBottom: 16 }}>
      <View style={[s.row, { gap: 10, alignItems: 'flex-start' }]}>
        <Icon.alert color="#fbbf24" size={18} />
        <Text style={{ flex: 1, fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: c.paper }}>{text}</Text>
      </View>
      <View style={[s.row, { justifyContent: 'flex-end', gap: 8, marginTop: 12 }]}>
        <Press onPress={theirs} style={{ backgroundColor: c.inkSurface2, borderRadius: 12, paddingHorizontal: 14, height: 38, justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.sansMedium, color: c.paper }}>Take theirs</Text>
        </Press>
        <Press onPress={mine} haptic style={{ backgroundColor: c.accent, borderRadius: 12, paddingHorizontal: 14, height: 38, justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.sansSemi, color: c.onAccent }}>Keep mine</Text>
        </Press>
      </View>
    </Animated.View>
  )

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.ink }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header
        onBack={onClose}
        title={<Text style={{ fontFamily: F.sans, fontSize: 12.5, color: flash ? c.accentLight : c.paperDimmer }}>{status} · {words} {words === 1 ? 'word' : 'words'}</Text>}
        right={<>
          <IconButton onPress={() => setPreview((p) => !p)} label={preview ? 'Edit' : 'Preview'}>
            {preview ? <Icon.pen color={c.accentLight} /> : <Icon.eye color={c.paperDim} />}
          </IconButton>
          <IconButton onPress={() => onDelete(note.id)} label="Delete"><Icon.trash color={c.paperDim} /></IconButton>
        </>}
      />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {incoming && <Banner text="This note changed on another device while you were writing." mine={() => { setIncoming(null); onSave({ ...note, title, body }); setPersisted({ title, body }) }} theirs={() => { setTitle(incoming.title); setBody(incoming.body); setPersisted(incoming); setIncoming(null) }} />}
        {!incoming && clash && <Banner text={`Changed on ${clash.device} ${ago(clash.at)}, while you were writing.`} mine={() => onResolveClash('mine')} theirs={() => onResolveClash('theirs')} />}

        <TextInput value={title} onChangeText={setTitle} placeholder="Untitled" placeholderTextColor={c.paperDimmer}
          selectionColor={alpha(c.accentLight, 0.5)} style={{ fontFamily: F.serif, fontSize: 28, color: c.paper, paddingVertical: 4 }} />
        <View style={[s.row, { alignSelf: 'flex-start', gap: 6, backgroundColor: c.inkSurface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 6, marginBottom: 18 }]}>
          {kind === 'category' ? <Icon.hash size={13} color={c.accentLight} /> : kind === 'timeline' ? <Icon.read size={13} color={c.accentLight} /> : <Icon.pen size={13} color={c.accentLight} />}
          <Text style={{ fontFamily: F.sans, fontSize: 12, color: c.paperDimmer }}>{badge}</Text>
        </View>

        {note.type === 'snapshot' && note.mediaPath?.endsWith('.pdf') && (
          <Press onPress={async () => { if (!(await openInViewer(note.mediaPath!, 'application/pdf'))) Alert.alert('No PDF viewer', 'Install a PDF viewer to open snapshots, or open it on your desktop.') }}
            scale={0.98} style={[s.row, { gap: 14, backgroundColor: c.inkSurface, borderRadius: 18, padding: 16, marginBottom: 18 }]}>
            <Icon.doc color={c.accentLight} size={28} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.sansMedium, fontSize: 15.5, color: c.paper }}>PDF snapshot</Text>
              <Text style={{ fontFamily: F.sans, fontSize: 12.5, color: c.paperDimmer }}>Tap to open in your PDF viewer</Text>
            </View>
            <Icon.chevronRight color={c.paperDimmer} size={18} />
          </Press>
        )}
        {note.type === 'media' && (
          <Press onPress={() => onAttach({ ...note, title, body })} scale={0.98} style={{ marginBottom: 18 }}>
            {note.mediaPath
              ? <Image source={{ uri: fileUri(note.mediaPath) }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 18, backgroundColor: c.inkSurface }} resizeMode="contain" />
              : <View style={{ height: 170, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: c.inkSurface2, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Icon.imagePlus color={c.paperDimmer} size={28} /><Text style={{ fontFamily: F.sans, color: c.paperDimmer }}>Choose an image</Text>
                </View>}
          </Press>
        )}

        {preview
          ? (body ? <Markdown text={body} size={19} /> : <Text style={{ fontFamily: F.serifItalic, color: c.paperDimmer, fontSize: 18 }}>Nothing written yet.</Text>)
          : segs.map((seg, i) => seg.kind === 'table'
            ? <TableEditor key={`t${i}`} rows={seg.rows} onChange={(rows) => setSeg(i, rows)} onRemove={() => removeSeg(i)} />
            : seg.kind === 'image'
            // A picture line shows the picture while editing too; the × takes it out of this note (the file stays).
            ? <View key={`i${i}`}>
                {/^https?:/.test(seg.src)
                  ? <Image source={{ uri: seg.src }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 18, marginVertical: 8 }} resizeMode="contain" />
                  : <RevealImage name={seg.src} visible />}
                <View style={{ position: 'absolute', top: 16, right: 8 }}>
                  <IconButton onPress={() => removeSeg(i)} label="Remove picture" tint={alpha(c.ink, 0.7)}>
                    <Icon.close color={c.paper} size={18} />
                  </IconButton>
                </View>
              </View>
            : <TextInput key={`x${i}`} value={seg.text} onChangeText={(v) => setSeg(i, v)} multiline scrollEnabled={false}
                selection={forced && forced.i === i ? { start: forced.start, end: forced.end } : undefined}
                onSelectionChange={(e) => { sel.current = { i, start: e.nativeEvent.selection.start, end: e.nativeEvent.selection.end }; if (forced) setForced(undefined) }}
                autoFocus={!note.body && note.type === 'text' && i === 0}
                placeholder={i === 0 ? 'Begin anywhere…' : ''} placeholderTextColor={c.paperDimmer}
                selectionColor={alpha(c.accentLight, 0.5)} textAlignVertical="top"
                style={{ fontFamily: read, fontSize: 19, lineHeight: 31, color: c.paper, minHeight: segs.length === 1 ? 320 : 48 }} />)}
      </ScrollView>
      {!preview && (
        <View style={[s.row, { borderTopWidth: 1, borderTopColor: c.inkSurface2, backgroundColor: c.ink, paddingHorizontal: 8, paddingTop: 4, paddingBottom: Math.max(insets.bottom, 4) }]}>
          {TOOLS.map(({ I, t }) => (
            <IconButton key={t} label={t} onPress={() => apply(t)}><I color={c.paperDim} size={20} /></IconButton>
          ))}
        </View>
      )}
    </KeyboardAvoidingView>
  )
}
