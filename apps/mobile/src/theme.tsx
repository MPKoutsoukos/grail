import { createContext, useContext, type ReactNode } from 'react'
import { DEFAULT_THEME, isLight, type Theme, type ThemeColors } from '@grail/core'

// Same eight colours as the desktop (the theme rides along in the synced settings).
export type Palette = ThemeColors & { light: boolean; onAccent: string }

export const palette = (t: Theme = DEFAULT_THEME): Palette => ({ ...t.colors, light: isLight(t), onAccent: '#fffaf2' })

export const F = {
  serif: 'Newsreader_400Regular',
  serifItalic: 'Newsreader_400Regular_Italic',
  serifMedium: 'Newsreader_500Medium',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemi: 'Inter_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
}

export type ReadingFont = 'serif' | 'sans' | 'mono'
export const readFace = (f: ReadingFont) => (f === 'sans' ? F.sans : f === 'mono' ? F.mono : F.serif)

/** Colour with alpha, from a #rrggbb hex. */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

const Ctx = createContext<{ c: Palette; read: string }>({ c: palette(), read: F.serif })
export const useTheme = () => useContext(Ctx)
export function ThemeProvider({ theme, reading, children }: { theme: Theme; reading: ReadingFont; children: ReactNode }) {
  return <Ctx.Provider value={{ c: palette(theme), read: readFace(reading) }}>{children}</Ctx.Provider>
}
