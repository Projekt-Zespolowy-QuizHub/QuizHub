export const THEME_PREVIEWS: Record<string, string> = {
  default: 'from-[#1a1a2e] to-[#16213e]',
  galaxy: 'from-[#0d0d1a] to-[#1a0d2e]',
  ocean: 'from-[#0a1628] to-[#0d2b45]',
  forest: 'from-[#0d1f0d] to-[#142814]',
};

export function getThemePreview(code: string): string {
  return THEME_PREVIEWS[code] ?? THEME_PREVIEWS.default;
}
