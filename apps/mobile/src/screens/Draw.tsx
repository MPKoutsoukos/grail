// The phone drawing canvas, drawn with react-native-svg (plain source, no prebuilt
// graphics binaries, which keeps the app small). A stroke in
// progress lives entirely on the UI thread: the gesture worklet appends points and
// Reanimated feeds the path straight to the native SVG view, so ink follows the
// finger at display rate. Only finished strokes reach React.
//
// The eraser cuts ink away (a photo underneath shows through): each run of eraser
// strokes becomes a mask over everything drawn before it, never over what comes after.
//
// Same scene format as the desktop (@grail/core): the scene has its own size
// and is scaled to fit, so drawings look the same on every device.

import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Alert, Text, TextInput, View } from 'react-native'
import Svg, { G, Image as SvgImage, Mask, Path, Rect } from 'react-native-svg'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import Animated, { useAnimatedProps, useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Eraser, Minus, Pencil, Redo2, RectangleHorizontal, Circle, Undo2, BrushCleaning } from 'lucide-react-native'
import {
  DRAWING_COLORS, DRAWING_PAPER, DRAWING_SIZES, fitScene, newElementId, normalizeElement, parseScene, sceneSize,
  isDeleted, toBase64, type Note, type Scene, type SceneElement, type Tool,
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
// strokes) draw identically. They return SVG path data.

const NOTHING = 'M0 0' // a path that draws nothing

function strokeD(pts: number[]): string {
  'worklet'
  if (pts.length < 2) return NOTHING
  let d = `M${pts[0]} ${pts[1]}`
  if (pts.length === 2) return `${d}L${pts[0] + 0.01} ${pts[1]}`
  for (let i = 2; i < pts.length - 2; i += 2) {
    d += `Q${pts[i]} ${pts[i + 1]} ${(pts[i] + pts[i + 2]) / 2} ${(pts[i + 1] + pts[i + 3]) / 2}`
  }
  return `${d}L${pts[pts.length - 2]} ${pts[pts.length - 1]}`
}

function elementD(el: SceneElement): string {
  'worklet'
  if (el.tool === 'pen' || el.tool === 'eraser') return strokeD(el.points ?? [])
  if (el.tool === 'line') {
    const p = el.points ?? []
    return p.length >= 4 ? `M${p[0]} ${p[1]}L${p[2]} ${p[3]}` : NOTHING
  }
  let x = el.x ?? 0, y = el.y ?? 0, w = el.width ?? 0, h = el.height ?? 0
  if (w < 0) { x += w; w = -w }
  if (h < 0) { y += h; h = -h }
  if (el.tool === 'rect') return `M${x} ${y}H${x + w}V${y + h}H${x}Z`
  const rx = w / 2, ry = h / 2, cy = y + ry
  return `M${x} ${cy}A${rx} ${ry} 0 1 0 ${x + w} ${cy}A${rx} ${ry} 0 1 0 ${x} ${cy}Z`
}

const ElementNode = memo(function ElementNode({ el, stroke }: { el: SceneElement; stroke?: string }) {
  const d = useMemo(() => elementD(el), [el])
  return (
    <Path d={d} fill="none" stroke={stroke ?? el.stroke} strokeWidth={el.strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" />
  )
})

/** The finished elements. Each run of eraser strokes masks out everything drawn before it. */
function Layers({ elements, w, h }: { elements: SceneElement[]; w: number; h: number }) {
  let content: ReactNode[] = []
  for (let i = 0; i < elements.length;) {
    if (elements[i].tool !== 'eraser') { content.push(<ElementNode key={elements[i].id} el={elements[i]} />); i++; continue }
    const run: SceneElement[] = []
    while (i < elements.length && elements[i].tool === 'eraser') run.push(elements[i++])
    const id = `erase-${run[0].id}`
    content = [
      <Mask key={`${id}-mask`} id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
        <Rect x={0} y={0} width={w} height={h} fill="white" />
        {run.map((e) => <ElementNode key={e.id} el={e} stroke="black" />)}
      </Mask>,
      <G key={id} mask={`url(#${id})`}>{content}</G>,
    ]
  }
  return <>{content}</>
}

const AnimatedPath = Animated.createAnimatedComponent(Path)

/** Width and height from a PNG's header (older drawings were saved as plain PNGs). */
function pngSize(b: Uint8Array): { w: number; h: number } | null {
  if (b.length < 24 || b[1] !== 0x50 || b[2] !== 0x4e || b[3] !== 0x47) return null
  const u32 = (o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0
  return { w: u32(16), h: u32(20) }
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
  const svg = useRef<Svg>(null)
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
          const size = pngSize(bytes)
          if (size && !cancelled) {
            setBackground(`data:image/png;base64,${toBase64(bytes)}`)
            setDims(size)
          } else if (!cancelled) setDims(view)
        } catch { if (!cancelled) setDims(view) }
      } else {
        setDims(view) // a new drawing takes this screen's size
      }
      if (!cancelled) setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [view, loaded, note.id, note.drawingPath, readScene, readImage])

  const fit = dims && view ? fitScene(dims, view) : null

  // ---- the stroke in progress: UI thread only ------------------------------
  const draft = useSharedValue<SceneElement | null>(null)
  const fx = useSharedValue(0), fy = useSharedValue(0), fs = useSharedValue(1)
  const toolV = useSharedValue<Tool>(tool), colorV = useSharedValue(color), widthV = useSharedValue(width)
  useEffect(() => { if (fit) { fx.value = fit.x; fy.value = fit.y; fs.value = fit.scale } }, [fit, fx, fy, fs])
  useEffect(() => { toolV.value = tool; colorV.value = color; widthV.value = width }, [tool, color, width, toolV, colorV, widthV])

  const draftProps = useAnimatedProps(() => {
    const d = draft.value
    return { d: d ? elementD(d) : NOTHING }
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
        const base64 = await new Promise<string | null>((resolve) => {
          const node = svg.current
          if (!node) { resolve(null); return }
          const t = setTimeout(() => resolve(null), 3000)
          node.toDataURL((b64) => { clearTimeout(t); resolve(b64 || null) }, { width: Math.round(dims.w), height: Math.round(dims.h) })
        })
        if (base64) png = `data:image/png;base64,${base64}`
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
        <IconButton label="Delete" onPress={() => Alert.alert(
          isDeleted(note) ? 'Delete this drawing for good?' : 'Delete this drawing?',
          isDeleted(note) ? 'It’s already in #deleted. Its file and pictures go, and it can’t be brought back.' : 'It moves to #deleted: hidden everywhere, but search #deleted to find it again.', [
          { text: 'Cancel', style: 'cancel' }, { text: isDeleted(note) ? 'Delete for good' : 'Delete', style: 'destructive', onPress: () => onDelete(note.id) },
        ])}><Icon.trash color={c.paperDim} /></IconButton>
      </View>

      <View style={{ flex: 1, marginHorizontal: 12, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: c.inkSurface2, backgroundColor: alpha(c.inkSurface, 0.4) }}
        onLayout={(e) => { const { width: w, height: h } = e.nativeEvent.layout; if (!view) setView({ w, h }) }}>
        {fit && dims && (
          <GestureDetector gesture={pan}>
            <View style={{ flex: 1 }} collapsable={false}>
              <Svg ref={svg} pointerEvents="none" viewBox={`0 0 ${dims.w} ${dims.h}`}
                width={dims.w * fit.scale} height={dims.h * fit.scale} style={{ position: 'absolute', left: fit.x, top: fit.y }}>
                <Rect x={0} y={0} width={dims.w} height={dims.h} fill={DRAWING_PAPER} />
                {background && <SvgImage href={{ uri: background }} x={0} y={0} width={dims.w} height={dims.h} preserveAspectRatio="none" />}
                <Layers elements={elements} w={dims.w} h={dims.h} />
                {/* The stroke in progress. An eraser shows as paper until it's finished, then cuts through. */}
                <AnimatedPath animatedProps={draftProps} fill="none" stroke={tool === 'eraser' ? DRAWING_PAPER : color}
                  strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
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

