import React from 'react';

interface ChordLine {
  chords: string[];
  text: string;
}

export function parseChords(content: string): ChordLine[] {
  const lines = content.split('\n');
  return lines.map(line => {
    let chords: string[] = [];
    let text = '';
    let lastIndex = 0;
    const regex = /\[(.*?)\]/g;
    let match;

    while ((match = regex.exec(line)) !== null) {
      // Add text before the chord
      text += line.substring(lastIndex, match.index);
      // Place chord at the current text length
      chords[text.length] = match[1];
      lastIndex = regex.lastIndex;
    }
    text += line.substring(lastIndex);

    return { chords, text };
  });
}

export const SongDisplay: React.FC<{ content: string }> = ({ content }) => {
  const parsedLines = parseChords(content);

  return (
    <div className="font-mono text-lg leading-relaxed space-y-6 text-stone-800 dark:text-stone-200">
      {parsedLines.map((line, i) => (
        <div key={i} className="relative pt-6">
          <div className="absolute top-0 left-0 flex whitespace-pre">
            {line.chords.map((chord, idx) => (
              <span
                key={idx}
                className="text-blue-600 dark:text-blue-400 font-bold absolute"
                style={{ left: `${idx}ch` }}
              >
                {chord}
              </span>
            ))}
          </div>
          <div className="whitespace-pre">{line.text || ' '}</div>
        </div>
      ))}
    </div>
  );
};
