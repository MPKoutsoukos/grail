// Small, dependency-free byte helpers shared by the vault adapters and sync.

const enc = new TextEncoder()
const dec = new TextDecoder()

export const utf8 = (s: string): Uint8Array => enc.encode(s)
export const fromUtf8 = (b: Uint8Array): string => dec.decode(b)

export function toBase64(bytes: Uint8Array): string {
  let bin = ''
  const CHUNK = 0x8000 // avoid call-stack limits on big images
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource))
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('')
}

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  gif: 'image/gif', svg: 'image/svg+xml', md: 'text/markdown', json: 'application/json',
}

export const extOf = (name: string) => name.slice(name.lastIndexOf('.') + 1).toLowerCase()
export const mimeOf = (name: string) => MIME[extOf(name)] ?? 'application/octet-stream'

export function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const comma = dataUrl.indexOf(',')
  const mime = dataUrl.slice(5, dataUrl.indexOf(';'))
  return { bytes: fromBase64(dataUrl.slice(comma + 1)), mime }
}

export function extForMime(mime: string): string {
  const e = mime.split('/')[1] ?? 'png'
  return e === 'jpeg' ? 'jpg' : e.replace('svg+xml', 'svg')
}

export const bytesToDataUrl = (name: string, bytes: Uint8Array) =>
  `data:${mimeOf(name)};base64,${toBase64(bytes)}`
