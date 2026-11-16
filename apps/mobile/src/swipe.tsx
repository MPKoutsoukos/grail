// Swipe a row: left to delete (the caller asks first), right to detach it.
// The row follows the finger; past the threshold a light tick says "let go
// now". Vertical scrolling is untouched: the swipe only starts sideways.

import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import { scheduleOnRN } from 'react-native-worklets'
import * as Haptics from 'expo-haptics'
import { EASE_OUT } from './motion'
import { alpha, F, useTheme } from './theme'
import { Icon } from './icons'

const T = 96

const tick = () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }

export function SwipeRow({ children, onLeft, onRight, rightLabel = 'Move' }: {
  children: ReactNode
  onLeft: () => void
  onRight?: () => void
  rightLabel?: string
}) {
  const { c } = useTheme()
  const x = useSharedValue(0)
  const armed = useSharedValue(0)
  const canRight = !!onRight

  const pan = usePanGesture({
    activeOffsetX: [-16, 16],
    failOffsetY: [-12, 12],
    onUpdate: (e) => {
      'worklet'
      const dx = canRight ? e.translationX : Math.min(e.translationX, 24)
      x.value = dx
      const a = dx < -T ? -1 : dx > T ? 1 : 0
      if (a !== armed.value) { armed.value = a; if (a !== 0) scheduleOnRN(tick) }
    },
    onDeactivate: () => {
      'worklet'
      const a = armed.value
      armed.value = 0
      x.value = withTiming(0, { duration: 180, easing: EASE_OUT })
      if (a === -1) scheduleOnRN(onLeft)
      else if (a === 1 && onRight) scheduleOnRN(onRight)
    },
    onFinalize: () => {
      'worklet'
      if (x.value !== 0) x.value = withTiming(0, { duration: 180, easing: EASE_OUT })
    },
  })

  const row = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  const del = useAnimatedStyle(() => ({ opacity: interpolate(-x.value, [16, T], [0, 1], 'clamp') }))
  const move = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [16, T], [0, 1], 'clamp') }))

  return (
    <View>
      <Animated.View style={[{ position: 'absolute', right: 6, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'flex-end' }, del]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontFamily: F.sansMedium, fontSize: 13, color: '#f87171' }}>Delete</Text>
          <Icon.trash color="#f87171" size={20} />
        </View>
      </Animated.View>
      {canRight && (
        <Animated.View style={[{ position: 'absolute', left: 6, top: 0, bottom: 0, justifyContent: 'center' }, move]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon.chapters color={c.accentLight} size={20} />
            <Text style={{ fontFamily: F.sansMedium, fontSize: 13, color: c.accentLight }}>{rightLabel}</Text>
          </View>
        </Animated.View>
      )}
      <GestureDetector gesture={pan}>
        <Animated.View style={[row, { backgroundColor: alpha(c.ink, 1) }]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  )
}
