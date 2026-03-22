export const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

export function getMedalEmoji(index: number): string {
  if (index === 0) return '🥇';
  if (index === 1) return '🥈';
  if (index === 2) return '🥉';
  return `${index + 1}.`;
}
