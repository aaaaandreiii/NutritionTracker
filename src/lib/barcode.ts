export async function decodeBarcode(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.src = url
  try {
    await image.decode()
    const { BrowserMultiFormatReader } = await import('@zxing/browser')
    const reader = new BrowserMultiFormatReader()
    const result = await reader.decodeFromImageElement(image)
    return result.getText() || null
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}
