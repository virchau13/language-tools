import { DiagnosticCategory } from 'typescript';
import { Position } from 'vscode-html-languageservice';
import { Range, DiagnosticSeverity } from 'vscode-languageserver';

export function convertRange(text: string, range: { start?: number; length?: number }): Range {
  return Range.create(positionAt(range.start || 0, text), positionAt((range.start || 0) + (range.length || 0), text));
}

/** Clamps a number between min and max */
export function clamp(num: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, num));
}

/**
 * Get the line and character based on the offset
 * @param offset The index of the position
 * @param text The text for which the position should be retrived
 */
 export function positionAt(offset: number, text: string): Position {
  offset = clamp(offset, 0, text.length);

  const lineOffsets = getLineOffsets(text);
  let low = 0;
  let high = lineOffsets.length;
  if (high === 0) {
    return Position.create(0, offset);
  }

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (lineOffsets[mid] > offset) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  // low is the least x for which the line offset is larger than the current offset
  // or array.length if no line offset is larger than the current offset
  const line = low - 1;
  return Position.create(line, offset - lineOffsets[line]);
}

export function mapSeverity(category: DiagnosticCategory): DiagnosticSeverity {
  switch (category) {
    case DiagnosticCategory.Error:
      return DiagnosticSeverity.Error;
    case DiagnosticCategory.Warning:
      return DiagnosticSeverity.Warning;
    case DiagnosticCategory.Suggestion:
      return DiagnosticSeverity.Hint;
    case DiagnosticCategory.Message:
      return DiagnosticSeverity.Information;
  }
}

function getLineOffsets(text: string) {
  const lineOffsets = [];
  let isLineStart = true;

  for (let i = 0; i < text.length; i++) {
    if (isLineStart) {
      lineOffsets.push(i);
      isLineStart = false;
    }
    const ch = text.charAt(i);
    isLineStart = ch === '\r' || ch === '\n';
    if (ch === '\r' && i + 1 < text.length && text.charAt(i + 1) === '\n') {
      i++;
    }
  }

  if (isLineStart && text.length > 0) {
    lineOffsets.push(text.length);
  }

  return lineOffsets;
}