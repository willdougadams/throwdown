export const ADVERBS = [
  "anxiously", "bravely", "calmly", "daringly", "eagerly", "fiercely",
  "gladly", "hastily", "idly", "joyfully", "keenly", "lightly",
  "madly", "neatly", "openly", "proudly", "quietly", "rapidly",
  "silently", "tenderly", "urgently", "valiantly", "wildly",
  "xenially", "yearningly", "zealously"
];

export const VERBS = [
  "acting", "baking", "cooking", "dancing", "eating", "flying",
  "gaming", "hacking", "itching", "jumping", "kicking", "laughing",
  "mining", "napping", "opening", "playing", "quitting", "running",
  "sleeping", "talking", "unlocking", "voting", "walking",
  "xraying", "yelling", "zooming"
];

export const NOUNS = [
  "ape", "bear", "cat", "dog", "eagle", "fox",
  "goat", "horse", "iguana", "jaguar", "kangaroo", "lion",
  "monkey", "newt", "owl", "panda", "quail", "rabbit",
  "snake", "tiger", "unicorn", "viper", "wolf",
  "xerus", "yak", "zebra"
];

/**
 * Very simple fast hash for strings (djb2).
 */
function stringToHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
  }
  return Math.abs(hash);
}

/**
 * Translates an unreadable string (like a pubkey/address) into a deterministic human-readable string.
 * Example: frantically-shopping-beaver
 * 
 * @param address The string to translate
 * @returns A hyphenated readable name
 */
export function generateReadableName(address: string): string {
  if (!address) return "unknown-entity";
  
  // Create different hash seeds to ensure word combinations are well distributed
  const hash1 = stringToHash(address + "_adv");
  const hash2 = stringToHash(address + "_verb");
  const hash3 = stringToHash(address + "_noun");

  const adverb = ADVERBS[hash1 % ADVERBS.length];
  const verb = VERBS[hash2 % VERBS.length];
  const noun = NOUNS[hash3 % NOUNS.length];

  return `${adverb}-${verb}-${noun}`;
}
