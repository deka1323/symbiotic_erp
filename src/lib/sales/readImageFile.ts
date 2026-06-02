const MAX_BYTES = 2 * 1024 * 1024

export async function readImageAsDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select an image file')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Image must be 2 MB or smaller')
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read image'))
    reader.readAsDataURL(file)
  })
}
