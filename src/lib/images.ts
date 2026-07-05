import { supabase } from './supabase'

const BUCKET = 'item-images'
const MAX_SIZE = 512

// Downscale to keep uploads small (phone photos are huge; thumbnails don't
// need more than 512px) so the Supabase free-tier 1 GB lasts forever.
async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIZE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), 'image/webp', 0.85),
  )
}

// Best-effort cleanup of a replaced/removed photo so the free-tier storage
// doesn't slowly fill with orphaned files. Failures are ignored.
export async function deleteItemImage(url: string | null | undefined): Promise<void> {
  if (!url) return
  const marker = `/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return
  const path = decodeURIComponent(url.slice(idx + marker.length))
  try {
    await supabase.storage.from(BUCKET).remove([path])
  } catch {
    // ignore
  }
}

export async function uploadItemImage(file: File): Promise<string> {
  const blob = await downscale(file)
  const path = `${crypto.randomUUID()}.webp`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/webp' })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
