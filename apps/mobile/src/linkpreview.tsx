// Link previews, as chat apps show them: under a link in a note, the page's title, a line about it, its picture and
// the site. grail only goes online for one when you ask (tap "Preview", then confirm), or for every link once you've
// chosen "Always" (Settings → Link previews). It then fetches that one page (for YouTube, YouTube's own oEmbed
// description of the video) and nothing else, and keeps the preview on the phone so it isn't fetched again.
// Previews live beside the notes, not in them: they never end up in your markdown files or snapshots.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Alert, Image, Linking, Text, View } from 'react-native'
import { Directory, File, Paths } from 'expo-file-system'
import { Press, s } from './ui'
import { alpha, F, useTheme } from './theme'
import { Icon } from './icons'

export type Preview = { title: string; description: string; site: string; image: string | null; at: number }

/** A bare web address in text (trailing punctuation stays out of it). */
export const URL_RE = /https?:\/\/[^\s<>()[\]"'`]+[^\s<>()[\]"'`.,;:!?]/g

export function urlsIn(text: string): string[] {
  return [...new Set([...text.matchAll(URL_RE)].map((m) => m[0]))]
}

export const siteOf = (url: string) => (/^https?:\/\/([^/?#:]+)/i.exec(url)?.[1] ?? url).replace(/^www\./i, '').toLowerCase()
const originOf = (url: string) => /^(https?:\/\/[^/?#]+)/i.exec(url)?.[1] ?? ''

// ---------- "Always" or ask: the setting, given by the app ----------

const Ctx = createContext<{ always: boolean; setAlways: (v: boolean) => void }>({ always: false, setAlways: () => {} })
export function PreviewsProvider({ always, setAlways, children }: { always: boolean; setAlways: (v: boolean) => void; children: ReactNode }) {
  return <Ctx.Provider value={{ always, setAlways }}>{children}</Ctx.Provider>
}

// ---------- kept on the phone ----------

const STORE = new File(Paths.document, 'link-previews.json')
const PICTURES = new Directory(Paths.document, 'link-previews')
let cache: Record<string, Preview> | null = null
const listeners = new Set<() => void>()

async function loaded(): Promise<Record<string, Preview>> {
  if (cache) return cache
  try { cache = STORE.exists ? JSON.parse(await STORE.text()) : {} } catch { cache = {} }
  return cache!
}

async function keep(url: string, p: Preview) {
  const all = await loaded()
  all[url] = p
  try {
    if (!STORE.exists) STORE.create()
    await STORE.write(JSON.stringify(all))
  } catch { /* still shown this time; fetched again next time */ }
  listeners.forEach((f) => f())
}

function nameFor(url: string) {
  let h = 5381
  for (let i = 0; i < url.length; i++) h = ((h << 5) + h + url.charCodeAt(i)) | 0
  return `${(h >>> 0).toString(16)}.img`
}

async function keepPicture(pageUrl: string, imageUrl: string | null | undefined): Promise<string | null> {
  if (!imageUrl) return null
  const abs = imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl.startsWith('/') ? originOf(pageUrl) + imageUrl
    : /^https?:/i.test(imageUrl) ? imageUrl : `${originOf(pageUrl)}/${imageUrl}`
  try {
    if (!PICTURES.exists) PICTURES.create({ intermediates: true })
    const f = await File.downloadFileAsync(abs, new File(PICTURES, nameFor(pageUrl)), { idempotent: true })
    return f.uri
  } catch {
    return null
  }
}

// ---------- fetching one ----------

function timed(url: string, init: RequestInit = {}): Promise<Response> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 10_000)
  return fetch(url, { ...init, signal: ctl.signal }).finally(() => clearTimeout(t))
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }
const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
    : ENTITIES[e.toLowerCase()] ?? m).replace(/\s+/g, ' ').trim()

function meta(html: string, ...names: string[]): string {
  for (const n of names) {
    const a = new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*content=["']([^"']*)["']`, 'i').exec(html)
      ?? new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${n}["']`, 'i').exec(html)
    if (a?.[1]) return decode(a[1])
  }
  return ''
}

async function fetchPreview(url: string): Promise<Preview> {
  const site = siteOf(url)
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(site)) {
    const r = await timed(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`)
    if (r.ok) {
      const j = await r.json()
      return { title: String(j.title ?? ''), description: String(j.author_name ?? ''), site: 'YouTube',
        image: await keepPicture(url, j.thumbnail_url), at: Date.now() }
    }
  }
  const r = await timed(url, { headers: { Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en' } })
  if (!r.ok) throw new Error(`The page answered ${r.status}`)
  const type = r.headers.get('content-type') ?? ''
  if (type.startsWith('image/')) return { title: '', description: '', site, image: await keepPicture(url, url), at: Date.now() }
  const html = (await r.text()).slice(0, 500_000)
  const title = meta(html, 'og:title', 'twitter:title') || decode(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? '')
  return {
    title,
    description: meta(html, 'og:description', 'twitter:description', 'description'),
    site: meta(html, 'og:site_name') || site,
    image: await keepPicture(url, meta(html, 'og:image', 'og:image:url', 'twitter:image')),
    at: Date.now(),
  }
}

// ---------- the card ----------

export function LinkCards({ urls }: { urls: string[] }) {
  return <>{urls.slice(0, 3).map((u) => <LinkCard key={u} url={u} />)}</>
}

function LinkCard({ url }: { url: string }) {
  const { c } = useTheme()
  const { always, setAlways } = useContext(Ctx)
  const [p, setP] = useState<Preview | null | undefined>(cache ? cache[url] ?? null : undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const site = siteOf(url)

  useEffect(() => {
    let live = true
    const refresh = () => void loaded().then((all) => { if (live) setP(all[url] ?? null) })
    refresh()
    listeners.add(refresh)
    return () => { live = false; listeners.delete(refresh) }
  }, [url])

  const go = async () => {
    setBusy(true); setError(null)
    try { await keep(url, await fetchPreview(url)) } catch (e) {
      setError(e instanceof Error && e.name !== 'AbortError' ? e.message : 'The page didn’t answer')
    } finally { setBusy(false) }
  }
  useEffect(() => { if (always && p === null && !busy && !error) void go() }, [always, p]) // eslint-disable-line react-hooks/exhaustive-deps

  const ask = () => Alert.alert('Show a link preview?',
    `grail will fetch this page from ${site} to show its title and picture. It only goes online when you ask, and sends nothing but the request for that page.`,
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Always', onPress: () => { setAlways(true); void go() } }, { text: 'Show', onPress: () => void go() }])

  const open = () => void Linking.openURL(url)
  const frame = { marginVertical: 8, borderRadius: 16, backgroundColor: c.inkSurface, overflow: 'hidden' as const, borderWidth: 1, borderColor: c.inkSurface2 }

  if (p) {
    return (
      <Press onPress={open} scale={0.98} style={frame}>
        {p.image ? <Image source={{ uri: p.image }} style={{ width: '100%', aspectRatio: 1.91, backgroundColor: c.inkSurface2 }} resizeMode="cover" /> : null}
        <View style={{ padding: 12, gap: 3 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 0.6, color: c.paperDimmer, textTransform: 'uppercase' }}>{p.site}</Text>
          {p.title ? <Text numberOfLines={2} style={{ fontFamily: F.serifMedium, fontSize: 16, lineHeight: 21, color: c.paper }}>{p.title}</Text> : null}
          {p.description ? <Text numberOfLines={2} style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: c.paperDim }}>{p.description}</Text> : null}
        </View>
      </Press>
    )
  }
  return (
    <View style={[frame, s.row, { padding: 12, gap: 10 }]}>
      <Press onPress={open} style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.sansMedium, fontSize: 14, color: c.paper }}>{site}</Text>
        <Text numberOfLines={1} style={{ fontFamily: F.sans, fontSize: 12, color: error ? '#f87171' : c.paperDimmer }}>{error ?? url}</Text>
      </Press>
      <Press onPress={busy ? undefined : error ? () => void go() : ask} haptic
        style={[s.row, { gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: alpha(c.accent, 0.14) }]}>
        {busy ? <Icon.spinner color={c.accentLight} size={16} /> : <Icon.eye color={c.accentLight} size={16} />}
        <Text style={{ fontFamily: F.sansMedium, fontSize: 12.5, color: c.accentLight }}>{busy ? 'Fetching…' : error ? 'Try again' : 'Preview'}</Text>
      </Press>
    </View>
  )
}
