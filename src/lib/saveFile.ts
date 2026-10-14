/**
 * Hands a file to the user: the native share sheet where it can take files
 * (so on a phone it can go straight to Files, Drive or a chat), otherwise a
 * plain download.
 */
export async function saveFile(file: File): Promise<'shared' | 'saved' | 'cancelled'> {
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // NotAllowedError etc. — fall through to a plain download
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'saved'
}
