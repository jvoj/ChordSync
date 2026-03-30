// Czech chromatic scale (sharps preferred for output)
// Czech notation: H = B natural, B = Bb
const SEMITONE_TO_NOTE = ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'Ais', 'H'];

// Map every known note spelling → semitone (0–11)
const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  CIS: 1, 'C#': 1, CES: 11, CB: 11, DES: 1, DB: 1,
  D: 2,
  DIS: 3, 'D#': 3, ES: 3, EB: 3,
  E: 4,
  F: 5,
  FIS: 6, 'F#': 6, GES: 6, GB: 6,
  G: 7,
  GIS: 8, 'G#': 8, AS: 8, AB: 8,
  A: 9,
  AIS: 10, 'A#': 10, B: 10, BB: 10, HES: 10,
  H: 11,
};

// Ordered longest-first so greedy matching works correctly
const ROOT_PATTERNS = [
  'CIS', 'DIS', 'FIS', 'GIS', 'AIS', 'HES',
  'CES', 'DES', 'GES',
  'C#', 'D#', 'F#', 'G#', 'A#',
  'CB', 'DB', 'EB', 'GB', 'AB', 'BB',
  'ES', 'AS',
  'C', 'D', 'E', 'F', 'G', 'A', 'H', 'B',
];

function transposeChord(chord: string, semitones: number): string {
  const upper = chord.toUpperCase();
  const root = ROOT_PATTERNS.find(p => upper.startsWith(p));
  if (!root) return chord;

  const semitone = NOTE_TO_SEMITONE[root];
  if (semitone === undefined) return chord;

  const newSemitone = ((semitone + semitones) % 12 + 12) % 12;
  const newRoot = SEMITONE_TO_NOTE[newSemitone];
  const suffix = chord.slice(root.length);
  return newRoot + suffix;
}

export function transposeContent(content: string, semitones: number): string {
  if (semitones === 0) return content;
  return content.replace(/\[([^\]]+)\]/g, (_, chord) => `[${transposeChord(chord, semitones)}]`);
}

export function semitoneLabel(n: number): string {
  if (n === 0) return '0';
  return n > 0 ? `+${n}` : `${n}`;
}
