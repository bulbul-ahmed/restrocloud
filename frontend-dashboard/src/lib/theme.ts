/** Convert #rrggbb hex to "r g b" channel string for CSS rgb() */
export function hexToRgbChannels(hex: string): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '255 107 53' // fallback orange
  return `${r} ${g} ${b}`
}

export const DEFAULT_BRAND = '#ff6b35'

/** Apply a brand color to the document root CSS variable */
export function applyBrandColor(hex: string | null | undefined) {
  const color = hex || DEFAULT_BRAND
  document.documentElement.style.setProperty('--brand-rgb', hexToRgbChannels(color))
}
