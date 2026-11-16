// Images and drawings in the read: exact-size placeholders (the text never
// jumps), a soft reveal as they scroll into view, and a full-screen viewer that
// zooms out of the image you tapped. Pinch to zoom, swipe down to close.

import { useEffect, useRef, useState } from 'react'
import { Image, Modal, Pressable, View, useWindowDimensions, type HostInstance } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { GestureDetector, GestureHandlerRootView, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler'
import { scheduleOnRN } from 'react-native-worklets'
import { fileUri } from './store'
import { EASE_OUT } from './motion'
import { useTheme } from './theme'

// ---------------------------------------------------------------- sizes ---

const aspects = new Map<string, number>()
const waiting = new Map<string, Promise<number>>()

function loadAspect(name: string): Promise<number> {
  const known = aspects.get(name)
  if (known) return Promise.resolve(known)
  let p = waiting.get(name)
  if (!p) {
    p = new Promise<number>((resolve) => {
      Image.getSize(fileUri(name), (w, h) => { const a = w / h || 4 / 3; aspects.set(name, a); resolve(a) }, () => resolve(4 / 3))
    })
    waiting.set(name, p)
  }
  return p
}

/** Look up sizes ahead of scrolling, so placeholders are right the first time. */
export function prefetchAspects(names: string[]) { names.forEach((n) => { void loadAspect(n) }) }

export function useAspect(name: string): number {
  const [a, setA] = useState(() => aspects.get(name) ?? 0)
  useEffect(() => {
    let live = true
    if (!aspects.has(name)) loadAspect(name).then((x) => { if (live) setA(x) })
    return () => { live = false }
  }, [name])
  return a || aspects.get(name) || 4 / 3
}

export interface Opened { name: string; x: number; y: number; w: number; h: number; aspect: number }

// --------------------------------------------------------------- reveal ---

export function RevealImage({ name, visible, onOpen, radius = 18 }: {
  name: string; visible: boolean; onOpen?: (o: Opened) => void; radius?: number
}) {
  const { c } = useTheme()
  const aspect = useAspect(name)
  const shown = useSharedValue(visible ? 1 : 0)
  const ref = useRef<HostInstance>(null)
  useEffect(() => { if (visible) shown.value = withTiming(1, { duration: 260, easing: EASE_OUT }) }, [visible, shown])
  const style = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateY: (1 - shown.value) * 8 }] }))
  const open = () => ref.current?.measureInWindow((x, y, w, h) => onOpen?.({ name, x, y, w, h, aspect }))
  return (
    <View ref={ref} collapsable={false} style={{ width: '100%', aspectRatio: aspect, borderRadius: radius, backgroundColor: c.inkSurface, overflow: 'hidden', marginVertical: 8 }}>
      <Animated.View style={[{ flex: 1 }, style]}>
        <Pressable onPress={onOpen ? open : undefined} style={{ flex: 1 }}>
          <Image source={{ uri: fileUri(name) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </Pressable>
      </Animated.View>
    </View>
  )
}

// --------------------------------------------------------------- viewer ---

export function ImageViewer({ opened, onClose }: { opened: Opened | null; onClose: () => void }) {
  const [shown, setShown] = useState<Opened | null>(null)
  if (opened && opened !== shown) setShown(opened)
  if (!shown) return null
  return <Viewer key={`${shown.name}:${shown.x}:${shown.y}`} o={shown} onGone={() => { setShown(null); onClose() }} />
}

function Viewer({ o, onGone }: { o: Opened; onGone: () => void }) {
  const { width: W, height: H } = useWindowDimensions()
  let tw = W, th = W / o.aspect
  if (th > H * 0.92) { th = H * 0.92; tw = th * o.aspect }
  const tx = (W - tw) / 2, ty = (H - th) / 2

  const p = useSharedValue(0)          // 0 = where it was in the read, 1 = full screen
  const scale = useSharedValue(1), saved = useSharedValue(1)
  const panX = useSharedValue(0), panY = useSharedValue(0), drag = useSharedValue(0)
  useEffect(() => { p.value = withTiming(1, { duration: 260, easing: EASE_OUT }) }, [p])

  const close = () => {
    'worklet'
    scale.value = withTiming(1, { duration: 200 }); panX.value = withTiming(0, { duration: 200 }); panY.value = withTiming(0, { duration: 200 })
    drag.value = withTiming(0, { duration: 220, easing: EASE_OUT })
    p.value = withTiming(0, { duration: 220, easing: EASE_OUT }, (done) => { if (done) scheduleOnRN(onGone) })
  }

  const pinch = usePinchGesture({
    onUpdate: (e) => { 'worklet'; scale.value = Math.min(4, Math.max(1, saved.value * e.scale)) },
    onDeactivate: () => {
      'worklet'
      if (scale.value < 1.05) { scale.value = withTiming(1, { duration: 160 }); panX.value = withTiming(0); panY.value = withTiming(0) }
      saved.value = scale.value
    },
  })
  const pan = usePanGesture({
    onUpdate: (e) => {
      'worklet'
      if (scale.value > 1.01) { panX.value = e.translationX; panY.value = e.translationY }
      else drag.value = Math.max(0, e.translationY)
    },
    onDeactivate: () => {
      'worklet'
      if (scale.value <= 1.01 && drag.value > 120) { close(); return }
      drag.value = withTiming(0, { duration: 180, easing: EASE_OUT })
    },
  })
  const gestures = useSimultaneousGestures(pinch, pan)

  const lerp = (a: number, b: number, t: number) => { 'worklet'; return a + (b - a) * t }
  const img = useAnimatedStyle(() => ({
    position: 'absolute',
    left: lerp(o.x, tx, p.value), top: lerp(o.y, ty, p.value),
    width: lerp(o.w, tw, p.value), height: lerp(o.h, th, p.value),
    borderRadius: lerp(18, 0, p.value),
    transform: [{ translateX: panX.value }, { translateY: panY.value + drag.value }, { scale: scale.value * (1 - Math.min(drag.value / 2000, 0.15)) }],
  }))
  const backdrop = useAnimatedStyle(() => ({ opacity: p.value * (1 - Math.min(drag.value / 400, 0.7)) }))

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={() => close()}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#000' }, backdrop]} />
        <GestureDetector gesture={gestures}>
          <View style={{ flex: 1 }}>
            <Animated.Image source={{ uri: fileUri(o.name) }} style={img} resizeMode="contain" />
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  )
}
