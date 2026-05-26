import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_KEY as string

export const supabase = createClient(url, key)

export const STORAGE_BUCKET = 'clx-assets'

export function getPhotoUrl(storagePath: string): string {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

// Compress + resize image to max 1920px / 80% JPEG before upload
async function compressImage(file: File, maxPx = 1920, quality = 0.8): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { width, height } = img

      // Skip resize if already small enough
      if (width <= maxPx && height <= maxPx && file.type === 'image/jpeg') {
        resolve(file)
        return
      }

      // Scale down proportionally
      if (width > height && width > maxPx) {
        height = Math.round(height * maxPx / width)
        width = maxPx
      } else if (height >= width && height > maxPx) {
        width = Math.round(width * maxPx / height)
        height = maxPx
      }

      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return }
          resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }))
        },
        'image/jpeg',
        quality,
      )
    }

    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file) }
    img.src = objectUrl
  })
}

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB

export async function uploadFile(path: string, file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`Datei zu gross (max. 5 MB)`)
  }
  const toUpload = await compressImage(file)
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, toUpload, { upsert: true, contentType: toUpload.type || 'image/jpeg' })
  if (error) throw error
  return path
}

export async function deleteFile(path: string): Promise<void> {
  await supabase.storage.from(STORAGE_BUCKET).remove([path])
}
