export const FREE_AVATAR_KEYS = new Set(['fox', 'cat', 'bear', 'wolf']);

export const AVATARS = [
  { key: 'fox',       emoji: '🦊' },
  { key: 'cat',       emoji: '🐱' },
  { key: 'bear',      emoji: '🐻' },
  { key: 'wolf',      emoji: '🐺' },
  { key: 'lion',      emoji: '🦁' },
  { key: 'tiger',     emoji: '🐯' },
  { key: 'raccoon',   emoji: '🦝' },
  { key: 'frog',      emoji: '🐸' },
  { key: 'penguin',   emoji: '🐧' },
  { key: 'owl',       emoji: '🦉' },
  { key: 'butterfly', emoji: '🦋' },
  { key: 'dragon',    emoji: '🐉' },
  { key: 'unicorn',   emoji: '🦄' },
  { key: 'octopus',   emoji: '🐙' },
  { key: 'shark',     emoji: '🦈' },
  { key: 'turtle',    emoji: '🐢' },
  { key: 'robot',     emoji: '🤖' },
  { key: 'alien',     emoji: '👾' },
  { key: 'ninja',     emoji: '🥷' },
  { key: 'wizard',    emoji: '🧙' },
] as const;

export type AvatarKey = typeof AVATARS[number]['key'];

export const AVATAR_MAP: Record<string, string> = Object.fromEntries(
  AVATARS.map(a => [a.key, a.emoji])
);

export function getAvatarEmoji(key: string): string {
  return AVATAR_MAP[key] ?? '🦊';
}
