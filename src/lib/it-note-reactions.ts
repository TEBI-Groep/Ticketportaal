/**
 * Curated reaction palette for Interne notities (common chat / Windows emojis).
 * Kept outside `"use server"` so Client Components can import the array safely.
 */
export const IT_NOTE_REACTION_EMOJIS = [
  "👍",
  "👎",
  "❤️",
  "😂",
  "😮",
  "😢",
  "🎉",
  "👀",
] as const;

export type ItNoteReactionEmoji = (typeof IT_NOTE_REACTION_EMOJIS)[number];
