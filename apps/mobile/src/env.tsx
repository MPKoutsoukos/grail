// Which build this is: dev, qa, staging or prod (see app.config.js), and its build number.
// Anything but prod shows a small tag beside the wordmark, so test builds are never mistaken for the real app.

import Constants from 'expo-constants'
import { Text, View } from 'react-native'
import { Wordmark } from './icons'
import { alpha, F, useTheme } from './theme'

export type Env = 'dev' | 'qa' | 'staging' | 'prod'

export function buildInfo(): { env: Env; build: number | null } {
  const extra = (Constants.expoConfig?.extra ?? {}) as { env?: Env; build?: number }
  return { env: extra.env ?? 'prod', build: typeof extra.build === 'number' ? extra.build : null }
}

export function EnvMark() {
  const { c } = useTheme()
  const { env } = buildInfo()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Wordmark size={30} color={c.accentLight} />
      {env !== 'prod' && (
        <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: c.accentLight,
          backgroundColor: alpha(c.accent, 0.16), borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' }}>{env}</Text>
      )}
    </View>
  )
}
