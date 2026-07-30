import type { ImageQualityReport, QualityCheck } from '../domain/types'

const MAX_BYTES = 8 * 1024 * 1024
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function classifyGlare(
  clippedPixelRatio: number,
  contrast: number,
  edgeScore: number,
): QualityCheck['status'] {
  const lacksReadableDetail = contrast < 25 || edgeScore < 12
  if (clippedPixelRatio > 0.65 && lacksReadableDetail) return 'fail'
  if (clippedPixelRatio > 0.08) return 'warn'
  return 'pass'
}

async function loadImage(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' })
}

export async function inspectImage(file: File): Promise<ImageQualityReport> {
  if (!ACCEPTED_TYPES.has(file.type)) {
    return {
      width: 0,
      height: 0,
      canSubmit: false,
      checks: [{ code: 'mime', label: 'File type', status: 'fail', detail: 'Use a JPEG, PNG, or WebP image.' }],
    }
  }

  if (file.size > MAX_BYTES) {
    return {
      width: 0,
      height: 0,
      canSubmit: false,
      checks: [{ code: 'size', label: 'File size', status: 'fail', detail: 'Image must be 8 MB or smaller.' }],
    }
  }

  const bitmap = await loadImage(file)
  const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Image checks are unavailable in this browser.')
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const { data } = context.getImageData(0, 0, width, height)
  let brightPixels = 0
  let mean = 0
  let squared = 0
  let edgeEnergy = 0
  let samples = 0
  const previousRow = new Float32Array(width)

  for (let y = 0; y < height; y += 2) {
    let previous = 0
    for (let x = 0; x < width; x += 2) {
      const offset = (y * width + x) * 4
      const luminance = data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722
      mean += luminance
      squared += luminance * luminance
      if (luminance > 248) brightPixels += 1
      if (x > 0) edgeEnergy += Math.abs(luminance - previous)
      if (y > 0) edgeEnergy += Math.abs(luminance - previousRow[x])
      previous = luminance
      previousRow[x] = luminance
      samples += 1
    }
  }

  mean /= samples
  const contrast = Math.sqrt(Math.max(0, squared / samples - mean * mean))
  const glareRatio = brightPixels / samples
  const edgeScore = edgeEnergy / samples
  const glareStatus = classifyGlare(glareRatio, contrast, edgeScore)
  const checks: QualityCheck[] = []

  checks.push({
    code: 'resolution',
    label: 'Resolution',
    status: bitmapSizeStatus(file, width / scale, height / scale),
    detail:
      Math.min(width / scale, height / scale) >= 900
        ? `${Math.round(width / scale)} × ${Math.round(height / scale)} px`
        : 'Move closer or use a higher-resolution photo (900 px minimum short edge).',
  })
  checks.push({
    code: 'glare',
    label: 'Glare',
    status: glareStatus,
    detail:
      glareStatus === 'fail'
        ? 'Large clipped areas and low image detail may hide printed values; retake at a different light angle.'
        : glareStatus === 'warn'
          ? 'Bright areas were detected, but text detail remains usable. Confirm that no printed values are hidden.'
          : 'No significant clipped areas detected.',
  })
  checks.push({
    code: 'focus',
    label: 'Focus & text contrast',
    status: contrast < 25 || edgeScore < 12 ? 'fail' : contrast < 38 || edgeScore < 20 ? 'warn' : 'pass',
    detail: contrast < 38 || edgeScore < 20 ? 'Text may be soft or low contrast; hold steady and fill the frame.' : 'Contrast and edge detail look usable.',
  })
  checks.push({
    code: 'orientation',
    label: 'Orientation',
    status: 'warn',
    detail: 'Automatic rotation is attempted on the server. Confirm all text is upright in the preview.',
  })
  checks.push({
    code: 'crop',
    label: 'Crop',
    status: 'warn',
    detail: 'Confirm the serving line and every nutrient row are fully inside the photo.',
  })

  return {
    width: Math.round(width / scale),
    height: Math.round(height / scale),
    checks,
    canSubmit: !checks.some((check) => check.status === 'fail'),
  }
}

function bitmapSizeStatus(_file: File, width: number, height: number): QualityCheck['status'] {
  const shortEdge = Math.min(width, height)
  if (shortEdge < 600) return 'fail'
  if (shortEdge < 900) return 'warn'
  return 'pass'
}
