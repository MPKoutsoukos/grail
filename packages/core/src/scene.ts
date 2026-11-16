// A drawing's editable vector scene (`<id>.scene.json`), shared by the desktop
// (Konva) and phone (Skia) canvases. Coordinates are in the scene's own space
// (`width` × `height`); each device scales the whole scene to fit its screen,
// so a drawing made on a phone looks the same on a wide desktop and back.

export type Tool = 'pen' | 'eraser' | 'line' | 'rect' | 'ellipse'

export interface SceneElement {
  id: string
  tool: Tool
  stroke: string
  strokeWidth: number
  points?: number[]                 // pen / eraser / line: x0, y0, x1, y1, …
  x?: number; y?: number            // rect / ellipse: top-left
  width?: number; height?: number
}

export interface Scene {
  /** The scene's size. Missing in drawings from before it was recorded. */
  width?: number
  height?: number
  /** An image to trace over (data URL), stretched to the scene. */
  background?: string
  elements: SceneElement[]
}

export const DRAWING_PAPER = '#16130f'
export const DRAWING_COLORS = ['#f3ece0', '#e0954f', '#d9a74a', '#8fb36a', '#7fa9de', '#d47070']
export const DRAWING_SIZES = [2, 4, 8, 16]

export function parseScene(raw: string | null): Scene | null {
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as Partial<Scene>
    return { width: s.width, height: s.height, background: s.background, elements: Array.isArray(s.elements) ? s.elements : [] }
  } catch {
    return null
  }
}

/**
 * The scene's size: recorded, or for older drawings (sized by whatever window
 * they were drawn in) the smallest box holding everything, at least the view.
 */
export function sceneSize(scene: Scene, view: { w: number; h: number }): { w: number; h: number } {
  if (scene.width && scene.height) return { w: scene.width, h: scene.height }
  let w = view.w, h = view.h
  for (const e of scene.elements) {
    const pad = e.strokeWidth
    if (e.points) {
      for (let i = 0; i < e.points.length; i += 2) {
        w = Math.max(w, e.points[i] + pad)
        h = Math.max(h, e.points[i + 1] + pad)
      }
    } else {
      w = Math.max(w, (e.x ?? 0) + (e.width ?? 0) + pad)
      h = Math.max(h, (e.y ?? 0) + (e.height ?? 0) + pad)
    }
  }
  return { w: Math.round(w), h: Math.round(h) }
}

/** Uniform scale + centring offset that fits the scene inside the view. */
export function fitScene(scene: { w: number; h: number }, view: { w: number; h: number }) {
  const scale = Math.min(view.w / scene.w, view.h / scene.h)
  return { scale, x: (view.w - scene.w * scale) / 2, y: (view.h - scene.h * scale) / 2 }
}

/** Shapes dragged up-left have negative sizes; store them normalised. */
export function normalizeElement(el: SceneElement): SceneElement {
  if (el.width === undefined || el.height === undefined) return el
  let { x = 0, y = 0, width, height } = el
  if (width < 0) { x += width; width = -width }
  if (height < 0) { y += height; height = -height }
  return { ...el, x, y, width, height }
}

export const newElementId = () => Math.random().toString(36).slice(2)
