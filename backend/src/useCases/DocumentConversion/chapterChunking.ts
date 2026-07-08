import { DocumentChunk, ExtractedDocument } from '../../models/DocumentConversion';

const MAX_HEADING_LENGTH = 120;

const CHAPTER_HEADING_PATTERNS = [
  /^(chapter|section|part)\s+[\dIVXLC]+[.:]?\s*(.*)$/i,
  /^[\d]{1,2}(\.[\d]{1,2}){0,3}[.:]?\s+[A-Z]/,
  /^[IVXLC]+\.\s+[A-Z]/,
];

export function isChapterOrSectionHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > MAX_HEADING_LENGTH) {
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

  return chunks.length > 0 ? chunks : null;
}

function splitByParagraphs(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return paragraphs.length > 0 ? paragraphs : [text];
}

export function chunkDocumentByChapter(document: ExtractedDocument): DocumentChunk[] {
  const normalizedText = document.text.replace(/\r\n/g, '\n').trim();
  const chapterTexts =
    splitByChapterHeadings(normalizedText) ?? splitByParagraphs(normalizedText);

  return chapterTexts.map((text, index) => ({
    document_id: document.document_id,
    chunk_id: `${document.document_id}-${index}`,
    text,
  }));
}
