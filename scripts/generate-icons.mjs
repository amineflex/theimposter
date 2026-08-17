/**
 * Génère les icônes PWA et l'image OpenGraph sans dépendance externe.
 *
 * Les PNG sont écrits à la main (chunks IHDR/IDAT/IEND + zlib du cœur de Node) :
 * pas de sharp, pas de canvas, résultat identique sur toutes les machines.
 *
 * Usage : npm run icons
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const here = dirname(fileURLToPath(import.meta.url))
const outputDir = resolve(here, '../public/icons')
mkdirSync(outputDir, { recursive: true })

// Palette du jeu (cf. tokens de globals.css) : crème, rouge tomate, encre.
const BACKGROUND = [255, 248, 231] // --cream  #FFF8E7
const MASK = [240, 68, 56] // --red    #F04438
const EYE = [32, 32, 32] // --ink    #202020

/**
 * Dessine le logo : un masque de loup (haut arrondi, menton effilé) avec deux
 * yeux en amande inclinés. L'anticrénelage se fait par échantillonnage 3×3.
 */
function drawLogo(width, height) {
  const pixels = Buffer.alloc(width * height * 4)
  const scale = Math.min(width, height)
  const cx = width / 2
  const top = height / 2 - scale * 0.33
  const bottom = height / 2 + scale * 0.36
  const halfWidth = scale * 0.33
  // Largeur maximale au niveau des yeux.
  const eyeLevel = 0.34

  /** Demi-largeur du masque à la hauteur normalisée t ∈ [0,1]. */
  const maskHalfWidth = (t) => {
    if (t < 0 || t > 1) return 0
    const normalized =
      t <= eyeLevel ? (eyeLevel - t) / (eyeLevel + 0.015) : (t - eyeLevel) / (1 - eyeLevel)
    return halfWidth * Math.sqrt(Math.max(0, 1 - normalized * normalized))
  }

  const eyeAngle = 0.22 // radians, coins extérieurs relevés
  const eyeRx = scale * 0.085
  const eyeRy = scale * 0.055
  const eyeOffsetX = scale * 0.135
  const eyeY = top + (bottom - top) * 0.35

  const inMask = (x, y) => {
    const t = (y - top) / (bottom - top)
    return Math.abs(x - cx) <= maskHalfWidth(t)
  }

  const inEye = (x, y) => {
    for (const sign of [-1, 1]) {
      const dx = x - (cx + sign * eyeOffsetX)
      const dy = y - eyeY
      const angle = sign * eyeAngle
      const rx = dx * Math.cos(angle) + dy * Math.sin(angle)
      const ry = -dx * Math.sin(angle) + dy * Math.cos(angle)
      if ((rx / eyeRx) ** 2 + (ry / eyeRy) ** 2 <= 1) return true
    }
    return false
  }

  // Épaisseur du contour d'encre, proportionnelle à la taille de l'icône.
  const outline = Math.max(1.5, scale * 0.022)
  const SAMPLES = 3
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let maskHits = 0
      let outlineHits = 0
      let total = 0
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const px = x + (sx + 0.5) / SAMPLES
          const py = y + (sy + 0.5) / SAMPLES
          total++
          const inside = inMask(px, py)
          const eye = inEye(px, py)
          if (inside && !eye) maskHits++
          // Bande d'encre : bord extérieur de la silhouette et bord des yeux.
          if (inside !== inMask(px + outline, py) || inside !== inMask(px, py + outline)) {
            outlineHits++
          } else if (eye !== inEye(px + outline, py) || eye !== inEye(px, py + outline)) {
            outlineHits++
          }
        }
      }
      const ratio = maskHits / total
      const index = (y * width + x) * 4
      // Contour d'encre : anneau autour de la silhouette, comme dans l'UI.
      const outlineRatio = outlineHits / total
      const base =
        outlineRatio > 0.02
          ? EYE
          : [
              Math.round(BACKGROUND[0] + (MASK[0] - BACKGROUND[0]) * ratio),
              Math.round(BACKGROUND[1] + (MASK[1] - BACKGROUND[1]) * ratio),
              Math.round(BACKGROUND[2] + (MASK[2] - BACKGROUND[2]) * ratio),
            ]
      pixels[index] = base[0]
      pixels[index + 1] = base[1]
      pixels[index + 2] = base[2]
      pixels[index + 3] = 255
    }
  }
  return pixels
}

/** Encode un buffer RGBA en PNG (type couleur 6, 8 bits). */
function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filtre "None"
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }

  const chunks = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr(width, height)),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]
  return Buffer.concat(chunks)
}

function ihdr(width, height) {
  const buffer = Buffer.alloc(13)
  buffer.writeUInt32BE(width, 0)
  buffer.writeUInt32BE(height, 4)
  buffer[8] = 8 // profondeur
  buffer[9] = 6 // RGBA
  return buffer
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuffer = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}

const targets = [
  { name: 'icon-192.png', width: 192, height: 192 },
  { name: 'icon-512.png', width: 512, height: 512 },
  { name: 'icon-maskable-512.png', width: 512, height: 512, maskable: true },
  { name: 'apple-touch-icon.png', width: 180, height: 180 },
  { name: 'og.png', width: 1200, height: 630 },
]

for (const target of targets) {
  const pixels = target.maskable
    ? drawLogoWithPadding(target.width, target.height)
    : drawLogo(target.width, target.height)
  writeFileSync(resolve(outputDir, target.name), encodePng(target.width, target.height, pixels))
  console.log(`écrit : public/icons/${target.name} (${target.width}×${target.height})`)
}

/** Version maskable : logo réduit pour respecter la zone de sécurité (80 %). */
function drawLogoWithPadding(width, height) {
  const inner = drawLogo(Math.round(width * 0.7), Math.round(height * 0.7))
  const innerWidth = Math.round(width * 0.7)
  const innerHeight = Math.round(height * 0.7)
  const pixels = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4
      pixels[index] = BACKGROUND[0]
      pixels[index + 1] = BACKGROUND[1]
      pixels[index + 2] = BACKGROUND[2]
      pixels[index + 3] = 255
    }
  }
  const offsetX = Math.round((width - innerWidth) / 2)
  const offsetY = Math.round((height - innerHeight) / 2)
  for (let y = 0; y < innerHeight; y++) {
    inner.copy(
      pixels,
      ((y + offsetY) * width + offsetX) * 4,
      y * innerWidth * 4,
      (y + 1) * innerWidth * 4,
    )
  }
  return pixels
}
