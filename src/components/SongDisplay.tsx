import React from 'react';

interface Segment {
  chord: string | null;
  text: string;
}

function parseLine(line: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /\[(.*?)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(line)) !== null) {
    const textBefore = line.substring(lastIndex, match.index);
    if (segments.length === 0 && textBefore) {
      segments.push({ chord: null, text: textBefore });
    } else if (segments.length > 0 && textBefore) {
      segments[segments.length - 1].text += textBefore;
    }
    segments.push({ chord: match[1], text: '' });
    lastIndex = regex.lastIndex;
  }

  const remaining = line.substring(lastIndex);
  if (segments.length === 0) {
    segments.push({ chord: null, text: remaining });
  } else if (remaining) {
    segments[segments.length - 1].text += remaining;
  }

  return segments;
}

export const SongDisplay: React.FC<{ content: string; fontSize?: number }> = ({ content, fontSize = 16 }) => {
  const lines = content.split('\n');

  return (
    <div className="font-mono leading-relaxed space-y-5 text-stone-800 dark:text-stone-200" style={{ fontSize }}>
      {lines.map((line, i) => {
        const segments = parseLine(line);
        const hasChords = segments.some(s => s.chord !== null);

        if (!hasChords) {
          return (
            <div key={i} className="break-words whitespace-pre-wrap min-h-[1.5em]">
              {segments[0]?.text || '\u00A0'}
            </div>
          );
        }

        return (
          <div key={i} className="flex flex-wrap items-end">
            {segments.map((seg, j) => (
              <span key={j} className="inline-block">
                <span className="block text-blue-600 dark:text-blue-400 font-bold leading-none mb-0.5" style={{ fontSize: fontSize * 0.8 }}>
                  {seg.chord ?? '\u00A0'}
                </span>
                <span className="whitespace-pre">{seg.text || (seg.chord ? '\u200B' : '\u00A0')}</span>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
};
