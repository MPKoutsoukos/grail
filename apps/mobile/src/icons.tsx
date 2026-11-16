// The same icon set as the desktop (Lucide, one stroke weight) plus grail's wordmark.

import Svg, { Path } from 'react-native-svg'
import { Text } from 'react-native'
import { F } from './theme'
import {
  ArrowLeft, BookOpen, Check, ChevronDown, ChevronRight, ChevronUp, Cloud, CloudAlert, CloudOff, Eye, Hash,
  ImagePlus, KeyRound, Library, ListOrdered, LoaderCircle, PenLine, Plus, RefreshCw, Search, Settings2, Shuffle,
  Sparkles, Trash2, X, Bold, Italic, Heading, List, Quote, CircleAlert, Image as ImageIcon, Server,
  Download, FileText, Table2, Minus,
  type LucideProps,
} from 'lucide-react-native'
import type { NoteType } from '@grail/core'

export const STROKE = 1.75
type P = LucideProps
const w = (I: React.ComponentType<P>) => (p: P) => <I strokeWidth={STROKE} size={22} {...p} />

export const Icon = {
  back: w(ArrowLeft), close: w(X), plus: w(Plus), search: w(Search), settings: w(Settings2), check: w(Check),
  trash: w(Trash2), chevronDown: w(ChevronDown), chevronUp: w(ChevronUp), chevronRight: w(ChevronRight),
  eye: w(Eye), pen: w(PenLine), image: w(ImageIcon), imagePlus: w(ImagePlus), hash: w(Hash), library: w(Library),
  read: w(BookOpen), chapters: w(ListOrdered), sparkle: w(Sparkles), shuffle: w(Shuffle), alert: w(CircleAlert),
  cloud: w(Cloud), cloudOff: w(CloudOff), cloudAlert: w(CloudAlert), sync: w(RefreshCw), spinner: w(LoaderCircle),
  key: w(KeyRound), server: w(Server), bold: w(Bold), italic: w(Italic), heading: w(Heading), list: w(List), quote: w(Quote),
  download: w(Download), doc: w(FileText), table: w(Table2), minus: w(Minus),
}

/** grail's mark: just the word, in Newsreader, as on the app icon (the chalice is gone). */
export function Wordmark({ size = 28, color }: { size?: number; color: string }) {
  return (
    <Text style={{ fontFamily: F.serif, fontSize: size, lineHeight: size * 1.15, letterSpacing: -0.01 * size, color }}
      accessibilityRole="header">grail</Text>
  )
}

function Quill({ size = 22, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 3C12 4 7 9 5.5 17.5L5 21" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Path d="M20 3c.5 6-3.5 11-10.5 12.2" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 11.5 13.5 9" stroke={color} strokeWidth={STROKE} strokeLinecap="round" opacity={0.55} />
    </Svg>
  )
}

export function NoteTypeIcon({ type, color, size = 20 }: { type: NoteType; color: string; size?: number }) {
  if (type === 'drawing') return <Quill color={color} size={size} />
  if (type === 'media') return <Icon.image color={color} size={size} />
  if (type === 'snapshot') return <Icon.doc color={color} size={size} />
  return <Icon.pen color={color} size={size} />
}
