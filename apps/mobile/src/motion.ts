// grail's motion: short, eased, never bouncing. Everything runs on the UI thread.

import { Easing, SlideInDown, SlideOutDown, withTiming } from 'react-native-reanimated'

export const EASE_OUT = Easing.out(Easing.cubic)
export const EASE_IN = Easing.in(Easing.cubic)

/** A screen arrives: a short glide from slightly right, fading in. No overshoot. */
export const screenIn = () => {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ translateX: 28 }] },
    animations: {
      opacity: withTiming(1, { duration: 200, easing: EASE_OUT }),
      transform: [{ translateX: withTiming(0, { duration: 220, easing: EASE_OUT }) }],
    },
  }
}

/** A screen leaves: fades while drifting right. */
export const screenOut = () => {
  'worklet'
  return {
    initialValues: { opacity: 1, transform: [{ translateX: 0 }] },
    animations: {
      opacity: withTiming(0, { duration: 150, easing: EASE_IN }),
      transform: [{ translateX: withTiming(20, { duration: 150, easing: EASE_IN }) }],
    },
  }
}

/** Bottom sheets slide up and settle, without the springy overshoot. */
export const sheetIn = SlideInDown.duration(240).easing(EASE_OUT)
export const sheetOut = SlideOutDown.duration(180).easing(EASE_IN)

/** Press feedback: a slight dip and straight back. */
export const pressDown = (to: number) => withTiming(to, { duration: 90, easing: EASE_OUT })
export const pressUp = () => withTiming(1, { duration: 140, easing: EASE_OUT })
