export const DEFAULT_BRAND = '#ff6b35'

export function hexToRgbChannels(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '255 107 53'
  return `${r} ${g} ${b}`
}

export function applyBrandColor(hex: string | null | undefined) {
  if (typeof document === 'undefined') return
  const color = hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : DEFAULT_BRAND
  document.documentElement.style.setProperty('--brand-rgb', hexToRgbChannels(color))
}
