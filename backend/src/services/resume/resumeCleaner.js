/**
 * General-Purpose Resume Text Cleaner
 * Prepares raw extracted resume text for semantic section detection and entity parsing.
 */

class ResumeCleaner {
  /**
   * Cleans and normalizes raw text extracted from PDFs, DOCX, or OCR.
   * @param {string} rawText 
   * @returns {string} Cleaned, structured text
   */
  clean(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      return '';
    }

    let text = rawText;

    // 1. Normalize line breaks to \n
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 2. Strip form feed characters (\f) used by PDF parsers between pages
    text = text.replace(/\f/g, '\n');

    // 3. Remove chunk/page marker prefixes injected during RAG or PDF extraction
    // e.g. "[Page 1]: ", "[Page 2]", "Page 1 of 2", "- 1 -", "— 1 —"
    text = text.replace(/\[\s*Page\s+\d+\s*\]:?/gi, '');
    text = text.replace(/Page\s+\d+\s+of\s+\d+/gi, '');
    text = text.replace(/^[ \t]*[-—–]\s*\d+\s*[-—–][ \t]*$/gim, '');
    text = text.replace(/^[ \t]*Page\s+\d+[ \t]*$/gim, '');

    // 4. Normalize Unicode whitespace, non-breaking spaces, zero-width spaces
    text = text.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
    text = text.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');

    // 5. Fix hyphenated word breaks split across line breaks
    // e.g. "JavaScript frame-\nwork" -> "JavaScript framework"
    text = text.replace(/([a-zA-Z]{2,})-\s*\n\s*([a-zA-Z]{2,})/g, '$1$2');

    // 6. Standardize bullet characters at line starts
    // e.g. •, ●, ▪, ▫, ‣, ⁃, ◦, *, - followed by space
    text = text.replace(/^[ \t]*[•●▪▫‣⁃◦\u2022\u25E6\u25AA\u25AB\u2023]\s*/gim, '• ');
    text = text.replace(/^[ \t]*[-*]\s+/gim, '• ');

    // 7. Strip repeated identical lines across page boundaries (e.g. repeated header / candidate name on page 2)
    const lines = text.split('\n');
    const cleanedLines = [];
    const seenHeaderLines = new Set();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // If line is short and appears identically in multiple places as a top-level page header, deduplicate it
      if (line.length > 3 && line.length < 50 && !line.startsWith('•')) {
        const lower = line.toLowerCase();
        // Check if it looks like a page repeat marker
        if (lower.startsWith('page ') || lower.startsWith('curriculum vitae') || lower.startsWith('resume')) {
          if (seenHeaderLines.has(lower)) {
            continue;
          }
          seenHeaderLines.add(lower);
        }
      }
      cleanedLines.push(lines[i]);
    }

    text = cleanedLines.join('\n');

    // 8. Collapse 3 or more consecutive newlines into 2
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
  }
}

module.exports = new ResumeCleaner();
