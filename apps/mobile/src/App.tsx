import { useCallback, useEffect, useState } from 'react'
import { Alert, BackHandler, Image, Modal, Pressable, Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { screenIn, screenOut, sheetIn } from './motion'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import * as Print from 'expo-print'
import { File } from 'expo-file-system'
import { useFonts } from 'expo-font'
// Only the weights grail uses (the packages' roots would bundle every weight).
import { Newsreader_400Regular } from '@expo-google-fonts/newsreader/400Regular'
import { Newsreader_400Regular_Italic } from '@expo-google-fonts/newsreader/400Regular_Italic'
import { Newsreader_500Medium } from '@expo-google-fonts/newsreader/500Medium'
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular'
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium'
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold'
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular'
import { categoryPool, collectCategories, extForMime, notebookMarkdown, noteKind, type Note, type NoteType } from '@grail/core'
import { DataProvider, type Data } from './data'
import { PreviewsProvider } from './linkpreview'
import { ThemeProvider, alpha, palette, F, useTheme } from './theme'
import { Icon, NoteTypeIcon } from './icons'
import { IconButton, Press, Row, s } from './ui'
import { imageDataUri } from './store'
import { parseRow, tableStartsAt } from './table'
import { BrowseScreen } from './screens/Browse'
import { ReadScreen } from './screens/Read'
import { TagScreen, TagsScreen } from './screens/Tags'
import { EditorScreen } from './screens/Editor'
import { DrawScreen } from './screens/Draw'
import { AboutScreen, LicencesScreen, SettingsScreen } from './screens/Settings'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const inlineHtml = (s: string) => esc(s)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\*([^*]+)\*/g, '<em>$1</em>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')

/** The snapshot's markdown as simple HTML for the PDF export. */
function mdToHtml(md: string, pics: Map<string, string> = new Map()): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  let para: string[] = []
  let list: 'ul' | 'ol' | null = null
  const flush = () => {
    if (para.length) { out.push(`<p>${inlineHtml(para.join(' '))}</p>`); para = [] }
    if (list) { out.push(`</${list}>`); list = null }
  }
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (!t) { flush(); continue }
    let m: RegExpExecArray | null
    if ((m = /^(#{1,6})\s+(.*)$/.exec(t))) { flush(); out.push(`<h${m[1].length}>${inlineHtml(m[2])}</h${m[1].length}>`); continue }
    if (tableStartsAt(lines, i)) {
      flush()
      const header = parseRow(lines[i])
      const rows = [header]
      i += 2
      while (i < lines.length && lines[i].trimStart().startsWith('|')) { const r = parseRow(lines[i]); rows.push(header.map((_, c) => r[c] ?? '')); i++ }
      i--
      out.push(`<table>${rows.map((r, ri) => `<tr>${r.map((c) => (ri === 0 ? `<th>${inlineHtml(c)}</th>` : `<td>${inlineHtml(c)}</td>`)).join('')}</tr>`).join('')}</table>`)
      continue
    }
    if ((m = /^\*([^*]+)\*$/.exec(t))) { flush(); out.push(`<p><em>${inlineHtml(m[1])}</em></p>`); continue }
    if ((m = /^!\[[^\]]*\]\(([^)\s]+)\)\s*$/.exec(t))) { flush(); const src = pics.get(m[1]); if (src) out.push(`<p><img src="${src}"/></p>`); continue }
    if ((m = /^\s*[-*+]\s+(.*)$/.exec(t))) { if (list !== 'ul') { flush(); out.push('<ul>'); list = 'ul' } out.push(`<li>${inlineHtml(m[1])}</li>`); continue }
    if ((m = /^\s*(\d+)[.)]\s+(.*)$/.exec(t))) { if (list !== 'ol') { flush(); out.push('<ol>'); list = 'ol' } out.push(`<li>${inlineHtml(m[2])}</li>`); continue }
    if (/^```/.test(t)) { flush(); const code: string[] = []; while (++i < lines.length && !/^```/.test(lines[i])) code.push(lines[i]); out.push(`<pre>${esc(code.join('\n'))}</pre>`); continue }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(t)) { flush(); out.push('<hr/>'); continue }
    if ((m = /^>\s?(.*)$/.exec(t))) { flush(); out.push(`<blockquote>${inlineHtml(m[1])}</blockquote>`); continue }
    para.push(t)
  }
  flush()
  return out.join('\n')
}

type Tab = 'browse' | 'read' | 'tags'
type Route =
  | { name: 'editor'; id: string }
  | { name: 'settings' }
  | { name: 'about' }
  | { name: 'licences' }
  | { name: 'tag'; tag: string }
  | { name: 'tagRead'; tag: string }

export default function App() {
  const [fonts] = useFonts({
    Newsreader_400Regular, Newsreader_400Regular_Italic, Newsreader_500Medium,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, JetBrainsMono_400Regular,
  })
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DataProvider>
          {(data) => (
            <ThemeProvider theme={data.settings.theme} reading={data.settings.readingFont}>
              <PreviewsProvider always={data.settings.linkPreviews === true} setAlways={(v) => data.updateSetting('linkPreviews', v)}>
                {fonts && !data.loading ? <Shell data={data} /> : <Splash />}
              </PreviewsProvider>
            </ThemeProvider>
          )}
        </DataProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

// The same picture and size as the native splash (app.json: splash.png at 200 wide), so one hands over to the other unseen.
// An image, not text: this shows while the fonts are still loading.
const SPLASH = require('../assets/splash.png')
function Splash() {
  const c = palette()
  return <View style={{ flex: 1, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}><Image source={SPLASH} style={{ width: 200, height: 200 }} /></View>
}

function Shell({ data }: { data: Data }) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<Tab>('browse')
  const [stack, setStack] = useState<Route[]>([])
  const [chooser, setChooser] = useState(false)
  const top = stack[stack.length - 1]
  const push = useCallback((r: Route) => setStack((st) => [...st, r]), [])
  const pop = useCallback(() => setStack((st) => st.slice(0, -1)), [])

  useEffect(() => { void SystemUI.setBackgroundColorAsync(c.ink) }, [c.ink])

  // Android back: close the sheet, then the top screen, then leave tabs to Browse.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (chooser) { setChooser(false); return true }
      if (stack.length) { pop(); return true }
      if (tab !== 'browse') { setTab('browse'); return true }
      return false
    })
    return () => sub.remove()
  }, [chooser, stack.length, tab, pop])

  const open = useCallback((n: Note) => push({ name: 'editor', id: n.id }), [push])
  const create = async (type: NoteType) => {
    setChooser(false)
    if (data.settings.haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const n = await data.createNote(type)
    push({ name: 'editor', id: n.id })
  }
  const attach = async (n: Note) => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 })
    if (r.canceled || !r.assets[0]) return
    const a = r.assets[0]
    const name = `${n.id}-media.${extForMime(a.mimeType ?? 'image/jpeg')}`
    await data.vault!.store.write(name, await new File(a.uri).bytes())
    await data.saveNote({ ...n, mediaPath: name })
  }

  const eligible = data.notes.filter((n) => noteKind(n) === 'timeline')
  const global = data.reviewView('', eligible)
  const [readNotebook, setReadNotebook] = useState<string | null>(null)
  const readEligible = readNotebook ? categoryPool(data.notes, readNotebook) : eligible
  const readCtx = data.reviewView(readNotebook ?? '', readEligible)
  const allTags = collectCategories(data.notes)
  const makeExport = useCallback((book: string | null, compiled: Note[]) => async (kind: 'md' | 'pdf') => {
    const vault = data.vault
    if (!vault || compiled.length === 0) return
    const id = String(Date.now())
    const when = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    const docTitle = book ? `#${book}` : 'Notebook'
    // Dated, so several snapshots of the same notebook can be told apart.
    const noteTitle = `${book ? `#${book}` : 'Notebook'} · snapshot · ${when}`
    const md = notebookMarkdown(docTitle, compiled)
    const done = (what: string) => Alert.alert('Snapshot saved', `${what} is in your notes as “${noteTitle}”.`, [
      { text: 'OK', style: 'cancel' },
      { text: 'Open', onPress: () => push({ name: 'editor', id }) },
    ])
    try {
      if (kind === 'md') {
        await data.saveNote({ id, type: 'snapshot', title: noteTitle, body: md, tags: [], created: Date.now(), updated: Date.now() })
        done('A markdown copy')
        return
      }
      // Pictures go into the PDF itself, not as "[image]" placeholders.
      const pics = new Map<string, string>()
      for (const n of compiled) {
        const pic = n.drawingPath ?? n.mediaPath
        if (pic && !pics.has(pic)) { const uri = await imageDataUri(pic); if (uri) pics.set(pic, uri) }
      }
      const html = `<html><head><meta charset="utf-8"/><style>body{font-family:Georgia,serif;line-height:1.6;max-width:42em;margin:0 auto;padding:2em 1em;color:#1c1917}h1,h2,h3{line-height:1.3}img{max-width:100%;border-radius:8px;margin:.6em 0}pre{white-space:pre-wrap;background:#f5f5f4;padding:1em;border-radius:8px}code{font-family:monospace}table{border-collapse:collapse}th,td{border:1px solid #d6d3d1;padding:4px 10px}th{background:#f5f5f4}</style></head><body>${mdToHtml(md, pics)}</body></html>`
      const { base64 } = await Print.printToFileAsync({ html, base64: true })
      if (!base64) throw new Error('The PDF came back empty')
      const name = `${id}.pdf`
      await vault.saveImage(name, `data:application/pdf;base64,${base64}`)
      await data.saveNote({ id, type: 'snapshot', title: noteTitle, body: '', tags: [], created: Date.now(), updated: Date.now(), mediaPath: name })
      done('A PDF copy')
    } catch (e) {
      Alert.alert('Couldn’t save the snapshot', e instanceof Error ? e.message : String(e))
    }
  }, [data, push])
  const header = (
    <>
      <IconButton onPress={() => push({ name: 'settings' })} label="Settings"><Icon.settings color={c.paperDim} /></IconButton>
    </>
  )

  let overlay: React.ReactNode = null
  if (top?.name === 'editor') {
    const note = data.notes.find((n) => n.id === top.id)
    if (note?.type === 'drawing') {
      const vault = data.vault!
      overlay = (
        <DrawScreen key={note.id} note={note}
          readScene={(id) => vault.readScene(id)}
          readImage={(name) => vault.store.read(name)}
          onPersist={async (n, png, scene) => {
            // The scene is the source of truth; the PNG is a preview for lists and Read.
            await vault.writeScene(n.id, scene)
            const old = n.drawingPath
            let drawingPath = old
            // A new name for every version: Android's image cache keys pictures by file, so
            // rewriting one name would keep showing the first version until grail restarted.
            if (png) { try { drawingPath = await vault.saveImage(`${n.id}-${Date.now().toString(36)}.png`, png) } catch { /* keep the old preview */ } }
            await data.saveNote({ ...n, ...(drawingPath ? { drawingPath } : {}) })
            // Only once the note points at the new picture does the old one go.
            if (old && old !== drawingPath && !old.startsWith('data:')) await vault.store.remove(old).catch(() => {})
          }}
          onDelete={(id) => { pop(); void data.deleteNote(id) }}
          onClose={pop} />
      )
    } else if (note) {
      overlay = (
        <EditorScreen key={note.id} note={note}
          clash={null}
          onResolveClash={() => {}}
          onSave={data.saveNote}
          onDelete={(id) => Alert.alert('Delete this note?', 'Its attachments go too.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => { pop(); void data.deleteNote(id) } },
          ])}
          onClose={pop}
          onAttach={attach} />
      )
    }
  } else if (top?.name === 'settings') overlay = <SettingsScreen data={data} onBack={pop} onOpenAbout={() => push({ name: 'about' })} />
  else if (top?.name === 'about') overlay = <AboutScreen onBack={pop} onOpenLicences={() => push({ name: 'licences' })} />
  else if (top?.name === 'licences') overlay = <LicencesScreen onBack={pop} />
  else if (top?.name === 'tag') overlay = <TagScreen tag={top.tag} notes={data.notes} onBack={pop} onOpen={open} onRead={() => push({ name: 'tagRead', tag: top.tag })} />
  else if (top?.name === 'tagRead') {
    const ctx = data.reviewView(top.tag, categoryPool(data.notes, top.tag))
    overlay = <ReadScreen notebook={top.tag} tags={allTags} notes={ctx.compiled} template={data.settings.reviewTemplate} onBack={pop}
      onEdit={(id) => push({ name: 'editor', id })} onMove={ctx.move} onRemove={ctx.remove}
      onDelete={(id) => void data.deleteNote(id)} onPlace={ctx.place} onExport={makeExport(top.tag, ctx.compiled)} />
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.ink }}>
      <StatusBar style={c.light ? 'dark' : 'light'} />
      {/* Tabs stay mounted underneath, so going back is instant and keeps scroll position. */}
      <View style={{ flex: 1 }}>
        {tab === 'browse' && <BrowseScreen notes={data.notes} removedIds={global.removedIds} echoes={data.settings.echoes} onOpen={open} header={header} />}
        {tab === 'read' && <ReadScreen notebook={readNotebook} onNotebook={setReadNotebook} tags={allTags}
          notes={readCtx.compiled} template={data.settings.reviewTemplate} header={header}
          onEdit={(id) => push({ name: 'editor', id })} onMove={readCtx.move} onRemove={readCtx.remove}
          onDelete={(id) => void data.deleteNote(id)} onPlace={readCtx.place} onExport={makeExport(readNotebook, readCtx.compiled)} />}
        {tab === 'tags' && <TagsScreen notes={data.notes} onOpen={open} onOpenTag={(tag) => push({ name: 'tag', tag })} header={header} />}

        {tab === 'browse' && (
          <Press onPress={() => setChooser(true)} haptic scale={0.95} accessibilityLabel="Create"
            style={{ position: 'absolute', right: 20, bottom: 20, width: 64, height: 64, borderRadius: 22, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: c.accent, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }}>
            <Icon.plus color={c.onAccent} size={28} strokeWidth={2} />
          </Press>
        )}
      </View>

      <View style={[s.row, { borderTopWidth: 1, borderTopColor: alpha(c.inkSurface2, 0.7), backgroundColor: c.ink, paddingBottom: insets.bottom, paddingTop: 6 }]}>
        {([['browse', 'Browse', Icon.library], ['read', 'Read', Icon.read], ['tags', 'Tags', Icon.hash]] as const).map(([k, label, I]) => {
          const on = tab === k
          return (
            <Pressable key={k} onPress={() => { if (data.settings.haptics && !on) void Haptics.selectionAsync(); setTab(k) }} style={{ flex: 1, alignItems: 'center', paddingBottom: 6 }}>
              <View style={{ width: 60, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? alpha(c.accent, 0.16) : 'transparent' }}>
                <I color={on ? c.accentLight : c.paperDimmer} size={22} />
              </View>
              <Text style={{ fontFamily: F.sansMedium, fontSize: 11.5, marginTop: 3, color: on ? c.accentLight : c.paperDimmer }}>{label}</Text>
            </Pressable>
          )
        })}
      </View>

      {overlay && (
        <Animated.View key={stack.length} entering={screenIn} exiting={screenOut}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: c.ink }}>
          {overlay}
        </Animated.View>
      )}

      <Modal visible={chooser} transparent animationType="none" onRequestClose={() => setChooser(false)} statusBarTranslucent>
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} style={{ flex: 1 }}>
          <Pressable onPress={() => setChooser(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
            <Animated.View entering={sheetIn} style={{ backgroundColor: c.inkSurface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingBottom: insets.bottom + 12 }}>
              <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.inkSurface2, marginBottom: 8 }} />
              {([['text', 'Fragment', 'Write — titled with the date and time'], ['drawing', 'Drawing', 'Sketch a map, a diagram, a face'], ['media', 'Image', 'Keep a reference picture']] as const).map(([t, label, hint]) => (
                <Row key={t} icon={<NoteTypeIcon type={t} color={c.accentLight} size={22} />} title={label} hint={hint} onPress={() => void create(t)} />
              ))}
            </Animated.View>
          </Pressable>
        </Animated.View>
      </Modal>
    </View>
  )
}
