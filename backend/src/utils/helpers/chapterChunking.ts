import {
  DocumentChunk,
  ExtractedDocument,
} from '../../models/DocumentConversion';

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
  /^[IVXLC]+\.\s+[A-Z]/,
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

export function isChapterOrSectionHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > MAX_HEADING_LENGTH) {
    return false;
  }

  if (isTableOfContentsEntry(trimmed) || looksLikeSentence(trimmed)) {
    return false;
  }

  return CHAPTER_HEADING_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function splitByChapterHeadings(text: string): string[] | null {
  const lines = text.split('\n');
  const headingIndices: number[] = [];

  for (let index = 0; index < lines.length; index++) {
    if (isChapterOrSectionHeading(lines[index])) {
      headingIndices.push(index);
    }
  }

  const hasMultipleSections =
    headingIndices.length >= 2 ||
    (headingIndices.length === 1 && headingIndices[0] > 0);

  if (!hasMultipleSections) {
    return null;
  }

  const chunks: string[] = [];
  let chunkStart = 0;

  for (const headingIndex of headingIndices) {
    if (headingIndex > chunkStart) {
      const preceding = lines.slice(chunkStart, headingIndex).join('\n').trim();
      if (preceding) {
        chunks.push(preceding);
      }
    }
    chunkStart = headingIndex;
  }

  const finalChunk = lines.slice(chunkStart).join('\n').trim();
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

function splitByParagraphs(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return paragraphs.length > 0 ? paragraphs : [text];
}

export function chunkDocumentByChapter(
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
