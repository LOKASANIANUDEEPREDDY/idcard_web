import type { CropShape, CustomShapeConfig } from '../types'

/**
 * Build a Path2D for the crop mask filling width × height.
 * `inset` shrinks the shape so centered strokes (borders) are not clipped
 * by the canvas edges.
 */
export function createShapePath(
  shape: CropShape,
  width: number,
  height: number = width,
  custom: CustomShapeConfig | null = null,
  inset = 0,
): Path2D {
  const pad = Math.max(
    0,
    Math.min(inset, Math.min(width, height) / 2 - 1),
  )
  const w = Math.max(2, width - pad * 2)
  const h = Math.max(2, height - pad * 2)
  const inner = buildShapePath(shape, w, h, custom)
  if (pad <= 0) return inner

  const path = new Path2D()
  path.addPath(inner, new DOMMatrix().translate(pad, pad))
  return path
}

function buildShapePath(
  shape: CropShape,
  width: number,
  height: number,
  custom: CustomShapeConfig | null,
): Path2D {
  const path = new Path2D()
  const cx = width / 2
  const cy = height / 2
  const rx = width / 2
  const ry = height / 2

  switch (shape) {
    case 'circle':
      path.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      break
    case 'square':
      path.rect(0, 0, width, height)
      break
    case 'rounded': {
      const radius = Math.min(width, height) * 0.12
      roundRect(path, 0, 0, width, height, radius)
      break
    }
    case 'heart':
      heartPath(path, width, height)
      break
    case 'star':
      starPath(path, cx, cy, 5, Math.min(rx, ry) * 0.95, Math.min(rx, ry) * 0.42)
      break
    case 'hexagon':
      polygonPath(path, cx, cy, 6, Math.min(rx, ry) * 0.98, width / height)
      break
    case 'curvedHex':
      curvedHexPath(path, cx, cy, Math.min(rx, ry) * 0.98, width / height)
      break
    case 'custom':
      if (custom?.type === 'svg' && custom.path) {
        try {
          const scaled = scaleSvgPath(custom.path, width, height)
          return new Path2D(scaled)
        } catch {
          path.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
        }
      } else if (custom?.type === 'polygon' && custom.points) {
        polygonFromPoints(path, custom.points, width, height)
      } else {
        path.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      }
      break
    default:
      path.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  }

  return path
}

function roundRect(
  path: Path2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  path.moveTo(x + radius, y)
  path.arcTo(x + w, y, x + w, y + h, radius)
  path.arcTo(x + w, y + h, x, y + h, radius)
  path.arcTo(x, y + h, x, y, radius)
  path.arcTo(x, y, x + w, y, radius)
  path.closePath()
}

function heartPath(path: Path2D, w: number, h: number) {
  path.moveTo(w * 0.5, h * 0.32)
  path.bezierCurveTo(w * 0.5, h * 0.18, w * 0.3, h * 0.05, w * 0.15, h * 0.2)
  path.bezierCurveTo(w * -0.02, h * 0.4, w * 0.08, h * 0.68, w * 0.5, h * 0.95)
  path.bezierCurveTo(w * 0.92, h * 0.68, w * 1.02, h * 0.4, w * 0.85, h * 0.2)
  path.bezierCurveTo(w * 0.7, h * 0.05, w * 0.5, h * 0.18, w * 0.5, h * 0.32)
  path.closePath()
}

function starPath(
  path: Path2D,
  cx: number,
  cy: number,
  points: number,
  outer: number,
  inner: number,
) {
  const step = Math.PI / points
  path.moveTo(cx, cy - outer)
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner
    const angle = -Math.PI / 2 + i * step
    path.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius)
  }
  path.closePath()
}

function polygonPath(
  path: Path2D,
  cx: number,
  cy: number,
  sides: number,
  radius: number,
  aspect = 1,
) {
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2
    const x = cx + Math.cos(angle) * radius * Math.min(1, aspect)
    const y = cy + Math.sin(angle) * radius * Math.min(1, 1 / aspect)
    if (i === 0) path.moveTo(x, y)
    else path.lineTo(x, y)
  }
  path.closePath()
}

function curvedHexPath(
  path: Path2D,
  cx: number,
  cy: number,
  radius: number,
  aspect = 1,
) {
  const sides = 6
  const sx = Math.min(1, aspect)
  const sy = Math.min(1, 1 / aspect)
  const points: { x: number; y: number }[] = []
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2
    points.push({
      x: cx + Math.cos(angle) * radius * sx,
      y: cy + Math.sin(angle) * radius * sy,
    })
  }
  const curve = radius * 0.18
  for (let i = 0; i < sides; i++) {
    const curr = points[i]
    const next = points[(i + 1) % sides]
    const midX = (curr.x + next.x) / 2
    const midY = (curr.y + next.y) / 2
    const dx = midX - cx
    const dy = midY - cy
    const len = Math.hypot(dx, dy) || 1
    const bulgeX = midX + (dx / len) * curve
    const bulgeY = midY + (dy / len) * curve
    if (i === 0) path.moveTo(curr.x, curr.y)
    path.quadraticCurveTo(bulgeX, bulgeY, next.x, next.y)
  }
  path.closePath()
}

function polygonFromPoints(path: Path2D, pointsStr: string, w: number, h: number) {
  const pairs = pointsStr
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
  if (pairs.length < 4) {
    path.rect(0, 0, w, h)
    return
  }
  for (let i = 0; i < pairs.length - 1; i += 2) {
    const x = pairs[i] * w
    const y = pairs[i + 1] * h
    if (i === 0) path.moveTo(x, y)
    else path.lineTo(x, y)
  }
  path.closePath()
}

/** Scale SVG path assuming 0–1 normalized coordinates into width×height. */
function scaleSvgPath(d: string, w: number, h: number): string {
  let index = 0
  return d.replace(/-?\d*\.?\d+/g, (num) => {
    const n = parseFloat(num)
    if (!Number.isFinite(n)) return num
    const scale = index % 2 === 0 ? w : h
    const looksNormalized = Math.abs(n) <= 1.5
    const value = looksNormalized ? n * scale : (n / 100) * scale
    index += 1
    return String(value)
  })
}

export const SHAPE_LABELS: Record<CropShape, string> = {
  circle: 'Circle',
  square: 'Square',
  rounded: 'Rounded',
  heart: 'Heart',
  star: 'Star',
  hexagon: 'Hexagon',
  curvedHex: 'Curved Hex',
  custom: 'Custom',
}
