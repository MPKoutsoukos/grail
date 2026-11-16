// Colour themes: eight role-based colours. Shared by every app (a theme lives in
// the synced settings file), so the same theme looks the same on phone and desktop.

export interface ThemeColors {
  ink: string         // app background
  inkSurface: string  // raised surfaces (cards, sheets)
  inkSurface2: string // borders, dividers, pressed states
  paper: string       // primary text
  paperDim: string    // secondary text
  paperDimmer: string // tertiary text / hints
  accent: string      // primary accent (buttons, active)
  accentLight: string // accent for text & icons on the background
}

export interface Theme {
  id: string
  name: string
  colors: ThemeColors
}


export const PRESETS: Theme[] = [
  {
    id: 'ink', name: 'Ink',
    colors: {
      ink: '#16130f', inkSurface: '#211c16', inkSurface2: '#2e271f',
      paper: '#f3ece0', paperDim: '#cfc5b4', paperDimmer: '#938875',
      accent: '#b5652a', accentLight: '#e0954f',
    },
  },
  {
    id: 'reliquary', name: 'Reliquary',
    colors: {
      ink: '#170d10', inkSurface: '#231519', inkSurface2: '#331f24',
      paper: '#f4e9dc', paperDim: '#d6c2b1', paperDimmer: '#9a8172',
      accent: '#8e2d34', accentLight: '#d9a74a',
    },
  },
  {
    id: 'vellum', name: 'Vellum',
    colors: {
      ink: '#f6f1e7', inkSurface: '#ece4d4', inkSurface2: '#ddd2bd',
      paper: '#28231b', paperDim: '#564d40', paperDimmer: '#7d7262',
      accent: '#9a4a17', accentLight: '#9a4a17',
    },
  },
  {
    id: 'moss', name: 'Moss',
    colors: {
      ink: '#11150f', inkSurface: '#1a2016', inkSurface2: '#252d1f',
      paper: '#e9ecdf', paperDim: '#bfc6ae', paperDimmer: '#848c73',
      accent: '#5d7a3a', accentLight: '#a8c27a',
    },
  },
  {
    id: 'midnight', name: 'Midnight',
    colors: {
      ink: '#0f1218', inkSurface: '#171c25', inkSurface2: '#222936',
      paper: '#e6ecf4', paperDim: '#b3bfcf', paperDimmer: '#7a8698',
      accent: '#3d6fae', accentLight: '#7fa9de',
    },
  },
]

export const DEFAULT_THEME: Theme = PRESETS[0]

export const THEME_KEYS: (keyof ThemeColors)[] = ['ink', 'inkSurface', 'inkSurface2', 'paper', 'paperDim', 'paperDimmer', 'accent', 'accentLight']

// Rough perceived lightness, used to pick status-bar style and image filters.
export function isLight(theme: Theme): boolean {
  const n = parseInt(theme.colors.ink.replace('#', ''), 16)
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 140
}

const HEX6 = /^#?[0-9a-fA-F]{6}$/

export function parseTheme(raw: string): Theme | null {
  try {
    const o = JSON.parse(raw)
    if (!o || typeof o !== 'object' || !o.colors) return null
    const colors = {} as ThemeColors
    for (const k of THEME_KEYS) {
      const v = o.colors[k]
      if (typeof v !== 'string' || !HEX6.test(v)) return null
      colors[k] = v.startsWith('#') ? v : `#${v}`
    }
    return { id: typeof o.id === 'string' ? o.id : 'custom', name: typeof o.name === 'string' ? o.name : 'Imported', colors }
  } catch {
    return null
  }
}
