import { DocumentChunk, ExtractedDocument } from '../models/DocumentConversion';

const MAX_HEADING_LENGTH = 120;

const NUMBER_WORDS =
  'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|' +
  'fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty';

const CHAPTER_HEADING_PATTERNS = [
  // "Chapter 1", "CHAPTER 2: Getting Started", "Section 3. Results", "Part IV", "Appendix A"
  /^(chapter|section|part|appendix)\s+([\dIVXLC]+|[A-Z])[.:]?\s*(.*)$/i,
  // "Chapter One", "Chapter Twenty: Conclusion"
  new RegExp(
    `^(chapter|section|part)\\s+(${NUMBER_WORDS})\\b[.:]?\\s*(.*)$`,
    'i',
  ),
  // "1. Introduction", "1.2 Methods"
  /^\d{1,2}(\.\d{1,2}){0,3}[.:]?\s+[A-Z]/,
  // "I. Overview"
  /^[IVXLCivxlc]+\.\s+[A-Z]/,
];

/**
 * Table-of-contents lines mimic real headings ("Chapter 1 .......... 5") but
 * are just an index entry, not the start of actual chapter content.
 */
function isTableOfContentsEntry(line: string): boolean {
  return /[.\s]{4,}\d{1,4}$/.test(line);
}

/**
 * A narrative sentence that happens to start with a number and a capitalized
 * word ("12 Monkeys Escaped From The Zoo.") can otherwise match the numbered
 * heading pattern. Real headings rarely end in terminal sentence punctuation,
 * except when explicitly prefixed by a heading keyword ("Chapter 2: Setup.").
 */
function looksLikeSentence(line: string): boolean {
  return (
    /[.!?]$/.test(line) && !/^(chapter|section|part|appendix)\b/i.test(line)
  );
}

export function isChapterOrSectionHeading(
  line: string,
  nextNonEmptyLine: string | null,
): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > MAX_HEADING_LENGTH) {
    return false;
  }

  if (isTableOfContentsEntry(trimmed) || looksLikeSentence(trimmed)) {
    return false;
  }

  if (CHAPTER_HEADING_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return true;
  }

  if (isAllCapsHeading(trimmed)) {
    return true;
  }

  if (isStructuralHeading(trimmed, nextNonEmptyLine)) {
    return true;
  }

  return false;
}

function splitByChapterHeadings(text: string): string[] | null {
  const lines = text.split('\n');
  const headingIndices: number[] = [];
  const nextNonEmptyLines: (string | null)[] = new Array(lines.length).fill(
    null,
  );
  let lookahead = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    nextNonEmptyLines[i] = lookahead;
    if (lines[i].trim()) {
      lookahead = lines[i].trim();
    }
  }

  for (let index = 0; index < lines.length; index++) {
    const currentLine = lines[index];
    const nextLine = nextNonEmptyLines[index];

    if (isChapterOrSectionHeading(currentLine, nextLine)) {
      headingIndices.push(index);
    } else if (
      isSimpleTitle(currentLine) &&
      nextLine !== null &&
      isChapterOrSectionHeading(nextLine, nextNonEmptyLines[index + 1] ?? null)
    ) {
      headingIndices.push(index);
    }
  }

  const filteredHeadingIndices: number[] = [];
  for (let i = 0; i < headingIndices.length; i++) {
    const currentIdx = headingIndices[i];
    const nextIdx = headingIndices[i + 1];

    filteredHeadingIndices.push(currentIdx);

    if (nextIdx !== undefined && nextIdx - currentIdx <= 4) {
      const linesBetween = lines.slice(currentIdx + 1, nextIdx);

      if (linesBetween.every((l) => !l.trim())) {
        i++;
      }
    }
  }

  const hasMultipleSections =
    filteredHeadingIndices.length >= 2 ||
    (filteredHeadingIndices.length === 1 && filteredHeadingIndices[0] > 0);

  if (!hasMultipleSections) {
    return null;
  }

  const chunks: string[] = [];
  let chunkStart = 0;

  for (const headingIndex of filteredHeadingIndices) {
    if (headingIndex > chunkStart) {
      const preceding = lines.slice(chunkStart, headingIndex).join('\n').trim();
      if (preceding) {
        chunks.push(preceding);
      }
    }
    chunkStart = headingIndex;
  }

  const finalChunkLines = lines
    .slice(chunkStart)
    .map((l) => l.trim())
    .filter(Boolean);

  const finalChunk = finalChunkLines.join('\n').trim();
  if (finalChunk) {
    chunks.push(finalChunk);
  }

  const meaningfulChunks = chunks.filter(
    (chunk) => !isTableOfContentsBlock(chunk),
  );

  return meaningfulChunks.length > 0 ? meaningfulChunks : null;
}

/**
 * A chunk made up entirely of ToC-style lines (e.g. a table of contents block
 * sitting before the first real heading) carries no real content and would
 * make a poor/noisy dataset sample, so it's dropped rather than kept as a chunk.
 */
function isTableOfContentsBlock(chunkText: string): boolean {
  const nonEmptyLines = chunkText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    nonEmptyLines.length > 0 && nonEmptyLines.every(isTableOfContentsEntry)
  );
}

function isAllCapsHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 4 || trimmed.length > MAX_HEADING_LENGTH) return false;

  const letters = trimmed.replace(/[^a-zA-Z]/g, '');
  if (letters.length === 0) return false;

  const upperCaseLetters = (trimmed.match(/[A-Z]/g) || []).length;
  const isAllUppercase = upperCaseLetters === letters.length;
  const isLabel = /^(note|figure|table|page|isbn)\b/i.test(trimmed);

  return isAllUppercase && !isLabel;
}

function isSimpleTitle(line: string): boolean {
  if (!line || line.length > 80 || /[.!?]$/.test(line)) return false;
  const words = line.match(/[a-zA-Z]+/g) || [];
  return (
    words.length >= 2 &&
    words.filter((w) => /^[A-Z]/.test(w)).length / words.length > 0.5
  );
}

function isStructuralHeading(
  line: string,
  nextNonEmptyLine: string | null,
): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 80) return false;
  if (/[.!?;:]$/.test(trimmed)) return false;
  if (!nextNonEmptyLine) return false;
  if (/^[a-z]/.test(nextNonEmptyLine)) return false;
  if (/^\(.*\)$/.test(trimmed)) return false;
  if (/^[a-z]/.test(trimmed)) return false;
  if (/\.\(/.test(trimmed)) return false;
  if (
    /\b(discussed\s+in|mentioned\s+in|see\s+(chapter|section|page|fig)|refer\s+to|cf\.)/i.test(
      trimmed,
    )
  )
    return false;
  return nextNonEmptyLine.trim().length > trimmed.length * 2;
}

function splitByParagraphs(text: string): string[] {
  const lines = text.split('\n');
  const paragraphs: string[] = [];
  let currentParagraphLines: string[] = [];
  for (const line of lines) {
    if (line.trim() === '') {
      if (currentParagraphLines.length > 0) {
        const joined = currentParagraphLines
          .map((l) => l.trim())
          .filter(Boolean)
          .join('\n');
        if (joined) paragraphs.push(joined);
        currentParagraphLines = [];
      }
    } else {
      currentParagraphLines.push(line);
    }
  }
  if (currentParagraphLines.length > 0) {
    const joined = currentParagraphLines
      .map((l) => l.trim())
      .filter(Boolean)
      .join('\n');
    if (joined) paragraphs.push(joined);
  }

  return paragraphs.length > 0 ? paragraphs : [text.trim()];
}

export function chunkDocumentBySection(
  document: ExtractedDocument,
): DocumentChunk[] {
  const normalizedText = document.text.replace(/\r\n/g, '\n').trim();
  const chapterTexts =
    splitByChapterHeadings(normalizedText) ?? splitByParagraphs(normalizedText);

  return chapterTexts.map((text, index) => ({
    document_id: document.document_id,
    chunk_id: `${document.document_id}-${index}`,
    text,
  }));
}
