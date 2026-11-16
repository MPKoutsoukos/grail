// The phone drawing canvas (Skia). A stroke in progress lives entirely on the UI
// thread — the gesture worklet appends points, Skia redraws the path — so ink
// follows the finger at display rate. Only finished strokes reach React.
//
// Same scene format as the desktop (@grail/core): the scene has its own size
// and is scaled to fit, so drawings look the same on every device.

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Text, TextInput, View } from 'react-native'
import {
  Canvas, Group, Image as SkiaImage, Path, Rect, Skia, rect, useCanvasRef, usePathValue,
  type SkImage, type SkPathBuilder,
} from '@shopify/react-native-skia'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import { useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Eraser, Minus, Pencil, Redo2, RectangleHorizontal, Circle, Undo2, BrushCleaning } from 'lucide-react-native'
import {
  DRAWING_COLORS, DRAWING_PAPER, DRAWING_SIZES, fitScene, newElementId, normalizeElement, parseScene, sceneSize,
  toBase64, type Note, type Scene, type SceneElement, type Tool,
} from '@grail/core'
import { IconButton, Press, s } from '../ui'
import { alpha, F, useTheme } from '../theme'
import { Icon, STROKE } from '../icons'

const TOOLS: { tool: Tool; I: typeof Pencil; label: string }[] = [
  { tool: 'pen', I: Pencil, label: 'Pen' },
  { tool: 'eraser', I: Eraser, label: 'Eraser' },
  { tool: 'line', I: Minus, label: 'Line' },
  { tool: 'rect', I: RectangleHorizontal, label: 'Rectangle' },
  { tool: 'ellipse', I: Circle, label: 'Ellipse' },
]

// ------------------------------------------------------------ geometry ---
// Plain functions marked as worklets, so the UI thread (draft) and JS (saved
// strokes) draw identically.

function strokeInto(b: SkPathBuilder, pts: number[]) {
  'worklet'
  if (pts.length < 2) return
  b.moveTo(pts[0], pts[1])
  if (pts.length === 2) { b.lineTo(pts[0] + 0.01, pts[1]); return }
  for (let i = 2; i < pts.length - 2; i += 2) {
    b.quadTo(pts[i], pts[i + 1], (pts[i] + pts[i + 2]) / 2, (pts[i + 1] + pts[i + 3]) / 2)
  }
  b.lineTo(pts[pts.length - 2], pts[pts.length - 1])
}

function elementInto(b: SkPathBuilder, el: SceneElement) {
  'worklet'
  if (el.tool === 'pen' || el.tool === 'eraser') { strokeInto(b, el.points ?? []); return }
  if (el.tool === 'line') {
    const p = el.points ?? []
    if (p.length >= 4) { b.moveTo(p[0], p[1]); b.lineTo(p[2], p[3]) }
    return
  }
  let x = el.x ?? 0, y = el.y ?? 0, w = el.width ?? 0, h = el.height ?? 0
  if (w < 0) { x += w; w = -w }
  if (h < 0) { y += h; h = -h }
  const r = { x, y, width: w, height: h }
  if (el.tool === 'rect') b.addRect(r)
  else b.addOval(r)
}

const ElementNode = memo(function ElementNode({ el }: { el: SceneElement }) {
  const path = useMemo(() => {
    const b = Skia.PathBuilder.Make()
    elementInto(b, el)
    return b.detach()
  }, [el])
  return (
    <Path path={path} style="stroke" strokeWidth={el.strokeWidth} color={el.stroke}
      strokeCap="round" strokeJoin="round" blendMode={el.tool === 'eraser' ? 'clear' : 'srcOver'} />
  )
})

function imageFromDataUrl(url: string): SkImage | null {
  const comma = url.indexOf(',')
  if (comma < 0) return null
  return Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(url.slice(comma + 1)))
}

// --------------------------------------------------------------- screen ---

export function DrawScreen({ note, readScene, readImage, onPersist, onDelete, onClose }: {
  note: Note
  readScene: (id: string) => Promise<string | null>
  readImage: (name: string) => Promise<Uint8Array>
  onPersist: (note: Note, pngDataUrl: string | null, sceneJson: string) => Promise<void>
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const canvas = useCanvasRef()
  const [title, setTitle] = useState(note.title)
  const [view, setView] = useState<{ w: number; h: number } | null>(null)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const [background, setBackground] = useState<string | undefined>()
  const [loaded, setLoaded] = useState(false)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(DRAWING_COLORS[0])
  const [width, setWidth] = useState(DRAWING_SIZES[1])
  const [history, setHistory] = useState<SceneElement[][]>([[]])
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const elements = history[step]
  const dirty = useRef(false)
  // The gesture may call an older render's commit: read the undo position from a ref.
  const stepRef = useRef(step)
  useEffect(() => { stepRef.current = step }, [step])

  // ---- load the scene (or an older drawing's flattened PNG) ----------------
  useEffect(() => {
    if (!view || loaded) return
    let cancelled = false
    ;(async () => {
      const scene = parseScene(await readScene(note.id))
      if (cancelled) return
      if (scene) {
        setHistory([scene.elements]); setStep(0)
        setBackground(scene.background)
        setDims(sceneSize(scene, view))
      } else if (note.drawingPath) {
        try {
          const bytes = await readImage(note.drawingPath)
          const img = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes))
          if (img && !cancelled) {
            setBackground(`data:image/png;base64,${toBase64(bytes)}`)
            setDims({ w: img.width(), h: img.height() })
          }
        } catch { if (!cancelled) setDims(view) }
      } else {
        setDims(view) // a new drawing takes this screen's size
      }
      if (!cancelled) setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [view, loaded, note.id, note.drawingPath, readScene, readImage])

  const bgImage = useMemo(() => (background ? imageFromDataUrl(background) : null), [background])
  const fit = dims && view ? fitScene(dims, view) : null

  // ---- the stroke in progress: UI thread only ------------------------------
  const draft = useSharedValue<SceneElement | null>(null)
  const fx = useSharedValue(0), fy = useSharedValue(0), fs = useSharedValue(1)
  const toolV = useSharedValue<Tool>(tool), colorV = useSharedValue(color), widthV = useSharedValue(width)
  useEffect(() => { if (fit) { fx.value = fit.x; fy.value = fit.y; fs.value = fit.scale } }, [fit, fx, fy, fs])
  useEffect(() => { toolV.value = tool; colorV.value = color; widthV.value = width }, [tool, color, width, toolV, colorV, widthV])

  const draftPath = usePathValue((b) => {
    'worklet'
    const d = draft.value
    if (d) elementInto(b, d)
  })

  const commit = (el: SceneElement) => {
    const done = normalizeElement({ ...el, id: newElementId() })
    const at = stepRef.current
    setHistory((h) => [...h.slice(0, at + 1), [...h[at], done]])
    setStep(at + 1)
    stepRef.current = at + 1
    dirty.current = true
    // Clear the draft only once the finished stroke is on screen: no flicker.
    requestAnimationFrame(() => { draft.value = null })
  }

  const pan = usePanGesture({
    minDistance: 0,
    maxPointers: 1,
    onBegin: (e) => {
      'worklet'
      const x = (e.x - fx.value) / fs.value, y = (e.y - fy.value) / fs.value
      const t = toolV.value
      const base = { id: 'draft', tool: t, stroke: t === 'eraser' ? DRAWING_PAPER : colorV.value, strokeWidth: widthV.value }
      draft.value = t === 'pen' || t === 'eraser' ? { ...base, points: [x, y] }
        : t === 'line' ? { ...base, points: [x, y, x, y] }
        : { ...base, x, y, width: 0, height: 0 }
    },
    onUpdate: (e) => {
      'worklet'
      const x = (e.x - fx.value) / fs.value, y = (e.y - fy.value) / fs.value
      draft.modify((d) => {
        'worklet'
        if (!d) return d
        if (d.tool === 'pen' || d.tool === 'eraser') {
          const p = d.points!
          const dx = x - p[p.length - 2], dy = y - p[p.length - 1]
          if (dx * dx + dy * dy > 1.2) p.push(x, y) // skip sub-pixel jitter
        } else if (d.tool === 'line') {
          d.points![2] = x; d.points![3] = y
        } else {
          d.width = x - (d.x ?? 0); d.height = y - (d.y ?? 0)
        }
        return d
      })
    },
    onFinalize: () => {
      'worklet'
      const d = draft.value
      if (d) scheduleOnRN(commit, { ...d, points: d.points ? [...d.points] : undefined })
    },
  })

  // ---- saving --------------------------------------------------------------
  const persist = async (withPreview: boolean) => {
    if (!dims || !fit) return
    setSaving(true)
    let png: string | null = null
    if (withPreview) {
      try {
        const img = canvas.current?.makeImageSnapshot(rect(fit.x, fit.y, dims.w * fit.scale, dims.h * fit.scale))
        if (img) png = `data:image/png;base64,${img.encodeToBase64()}`
      } catch { /* the preview is best-effort; the scene is what matters */ }
    }
    const scene: Scene = { width: dims.w, height: dims.h, background, elements }
    await onPersist({ ...note, title }, png, JSON.stringify(scene))
    dirty.current = false
    setSaving(false)
  }
  const persistRef = useRef(persist)
  useEffect(() => { persistRef.current = persist })
  useEffect(() => {
    if (!dirty.current && title === note.title) return
    const t = setTimeout(() => { void persistRef.current(true) }, 800)
    return () => clearTimeout(t)
  }, [history, step, title, note.title])
  useEffect(() => () => { if (dirty.current) void persistRef.current(false) }, [])

  const close = async () => {
    if (dirty.current || title !== note.title) await persist(true)
    onClose()
  }

  const iconColor = (on: boolean) => (on ? c.onAccent : c.paperDim)
  return (
    <View style={{ flex: 1, backgroundColor: c.ink, paddingBottom: insets.bottom }}>
      <View style={[s.row, { paddingTop: insets.top + 6, paddingHorizontal: 8, paddingBottom: 6 }]}>
        <IconButton onPress={() => void close()} label="Back"><Icon.back color={c.paperDim} /></IconButton>
        <TextInput value={title} onChangeText={setTitle} placeholder="Untitled" placeholderTextColor={c.paperDimmer}
          style={{ flex: 1, fontFamily: F.serif, fontSize: 20, color: c.paper, paddingVertical: 4 }} />
        <Text style={{ fontFamily: F.sans, fontSize: 12, color: c.paperDimmer, marginHorizontal: 6 }}>{saving ? 'Saving…' : 'Saved'}</Text>
        <IconButton label="Delete" onPress={() => Alert.alert('Delete this drawing?', undefined, [
          { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => onDelete(note.id) },
        ])}><Icon.trash color={c.paperDim} /></IconButton>
      </View>

      <View style={{ flex: 1, marginHorizontal: 12, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: c.inkSurface2, backgroundColor: alpha(c.inkSurface, 0.4) }}
        onLayout={(e) => { const { width: w, height: h } = e.nativeEvent.layout; if (!view) setView({ w, h }) }}>
        {fit && dims && (
          <GestureDetector gesture={pan}>
            <Canvas ref={canvas} style={{ flex: 1 }}>
              <Group transform={[{ translateX: fit.x }, { translateY: fit.y }, { scale: fit.scale }]}>
                <Rect x={0} y={0} width={dims.w} height={dims.h} color={DRAWING_PAPER} />
                {bgImage && <SkiaImage image={bgImage} x={0} y={0} width={dims.w} height={dims.h} fit="fill" />}
                <Group layer clip={rect(0, 0, dims.w, dims.h)}>
                  {elements.map((el) => <ElementNode key={el.id} el={el} />)}
                  <Path path={draftPath} style="stroke" strokeWidth={width} color={tool === 'eraser' ? DRAWING_PAPER : color}
                    strokeCap="round" strokeJoin="round" blendMode={tool === 'eraser' ? 'clear' : 'srcOver'} />
                </Group>
              </Group>
            </Canvas>
          </GestureDetector>
        )}
      </View>

      <View style={{ marginHorizontal: 12, marginTop: 10, gap: 8 }}>
        <View style={[s.row, { justifyContent: 'space-between', backgroundColor: c.inkSurface, borderRadius: 18, padding: 6 }]}>
          <View style={[s.row, { gap: 2 }]}>
            {TOOLS.map(({ tool: t, I, label }) => (
              <Press key={t} onPress={() => setTool(t)} accessibilityLabel={label} scale={0.9}
                style={{ width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: tool === t ? c.accent : 'transparent' }}>
                <I size={20} strokeWidth={STROKE} color={iconColor(tool === t)} />
              </Press>
            ))}
          </View>
          <View style={[s.row, { gap: 2 }]}>
            <IconButton label="Undo" onPress={() => { if (step > 0) { setStep(step - 1); dirty.current = true } }}><Undo2 size={20} strokeWidth={STROKE} color={step > 0 ? c.paperDim : alpha(c.paperDim, 0.3)} /></IconButton>
            <IconButton label="Redo" onPress={() => { if (step < history.length - 1) { setStep(step + 1); dirty.current = true } }}><Redo2 size={20} strokeWidth={STROKE} color={step < history.length - 1 ? c.paperDim : alpha(c.paperDim, 0.3)} /></IconButton>
            <IconButton label="Clear" onPress={() => Alert.alert('Clear the whole drawing?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', style: 'destructive', onPress: () => { setHistory((h) => [...h.slice(0, step + 1), []]); setStep(step + 1); dirty.current = true } },
            ])}><BrushCleaning size={20} strokeWidth={STROKE} color={c.paperDim} /></IconButton>
          </View>
        </View>
        <View style={[s.row, { justifyContent: 'space-between', backgroundColor: c.inkSurface, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12 }]}>
          <View style={[s.row, { gap: 10 }]}>
            {DRAWING_COLORS.map((x) => (
              <Press key={x} onPress={() => { setColor(x); if (tool === 'eraser') setTool('pen') }} accessibilityLabel={`Colour ${x}`} scale={0.85}
                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: x, borderWidth: color === x && tool !== 'eraser' ? 3 : 1, borderColor: color === x && tool !== 'eraser' ? c.accentLight : 'rgba(0,0,0,0.3)' }} />
            ))}
          </View>
          <View style={[s.row, { gap: 4 }]}>
            {DRAWING_SIZES.map((x) => (
              <Press key={x} onPress={() => setWidth(x)} accessibilityLabel={`Size ${x}`} scale={0.85}
                style={{ width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: width === x ? c.inkSurface2 : 'transparent' }}>
                <View style={{ width: Math.min(x, 14) + 3, height: Math.min(x, 14) + 3, borderRadius: 10, backgroundColor: c.paper }} />
              </Press>
            ))}
          </View>
        </View>
      </View>
    </View>
  )
}

