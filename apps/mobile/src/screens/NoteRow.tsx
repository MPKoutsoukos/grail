import { memo } from 'react'
import { Image, Text, View } from 'react-native'
import { categoryName, excerpt, noteKind, type Note } from '@grail/core'
import { Press } from '../ui'
import { alpha, F, useTheme } from '../theme'
import { Icon, NoteTypeIcon } from '../icons'
import { fileUri } from '../store'

export function ago(ts: number, now = Date.now()): string {
  const m = Math.round((now - ts) / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  if (d < 30) return `${d} d ago`
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// Memoised: rows only re-render when their own note changes.
export const NoteRow = memo(function NoteRow({ note, onOpen, outOfRead }: { note: Note; onOpen: (n: Note) => void; outOfRead?: boolean }) {
  const { c } = useTheme()
  const kind = noteKind(note)
  const heading = kind === 'timeline' ? excerpt(note.body, 80) || note.title : note.title || 'Untitled'
  const sub = kind === 'timeline' ? note.title : excerpt(note.body)
  // Only pictures get a thumbnail (a PDF snapshot's mediaPath is not an image).
  const pic = note.drawingPath ?? (note.mediaPath && !note.mediaPath.endsWith('.pdf') ? note.mediaPath : undefined)
  return (
    <Press onPress={() => onOpen(note)} scale={0.985}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.inkSurface, borderRadius: 20, padding: 12, marginBottom: 8 }}>
      {pic ? (
        <Image source={{ uri: fileUri(pic) }} style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: c.ink }} />
      ) : (
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}>
          {categoryName(note) ? <Icon.hash color={c.accentLight} size={20} /> : <NoteTypeIcon type={note.type} color={c.accentLight} />}
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: F.serif, fontSize: 17.5, color: c.paper }}>{heading}</Text>
        <Text numberOfLines={1} style={{ fontFamily: F.sans, fontSize: 12.5, color: c.paperDimmer, marginTop: 2 }}>
          {ago(note.updated)}
          {kind === 'category' ? ' · tag page' : kind === 'loose' ? ' · loose' : ''}
          {sub && sub !== heading ? ` · ${sub}` : ''}
        </Text>
        {(note.tags.length > 0 || outOfRead) && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {note.tags.slice(0, 4).map((t) => (
              <Text key={t} style={{ fontFamily: F.mono, fontSize: 11, color: alpha(c.accentLight, 0.9), backgroundColor: c.ink, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' }}>#{t}</Text>
            ))}
            {outOfRead && <Text style={{ fontFamily: F.sans, fontSize: 11, color: c.paperDimmer, backgroundColor: c.ink, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' }}>out of Read</Text>}
          </View>
        )}
      </View>
    </Press>
  )
})
