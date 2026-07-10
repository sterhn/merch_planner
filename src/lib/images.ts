import { supabase, supabaseAnonKey, supabaseUrl } from './supabase'

const BUCKET = 'product-photos'
const MAX_SIZE = 1400

// Downscale to max 1400px on the long side and re-encode as WebP ~0.8 so
// phone photos (often 10+ MB) upload fast and the Supabase free-tier 1 GB
// lasts. Browsers without WebP encoding (older Safari) fall back to whatever
// toBlob returns, hence the extension/content-type mapping in the uploader.
async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIZE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), 'image/webp', 0.8),
  )
}

// Best-effort cleanup of a replaced/removed photo so the free-tier storage
// doesn't slowly fill with orphaned files. Handles URLs from the current
// bucket and the older item-images one. Failures are ignored.
export async function deleteItemImage(url: string | null | undefined): Promise<void> {
  if (!url) return
  const match = url.match(/\/object\/public\/([^/]+)\/(.+)$/)
  if (!match) return
  try {
    await supabase.storage.from(match[1]).remove([decodeURIComponent(match[2])])
  } catch {
    // ignore
  }
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
}

// Uploads via XMLHttpRequest instead of supabase-js so onProgress can report
// real upload progress (fetch can't observe request-body progress).
export async function uploadItemImage(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const blob = await downscale(file)
  const path = `${crypto.randomUUID()}.${EXT_BY_TYPE[blob.type] ?? 'webp'}`
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in')

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${supabaseUrl}/storage/v1/object/${BUCKET}/${path}`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', supabaseAnonKey)
    xhr.setRequestHeader('Content-Type', blob.type || 'image/webp')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total)
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`))
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.send(blob)
  })

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
