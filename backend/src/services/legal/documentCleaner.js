/**
 * Document Cleaner & Preprocessor for Legal, Financial, and Insurance Documents.
 * Cleans extraction noise while strictly preserving page markers, section headers,
 * and paragraph structure for source traceability.
 */

class DocumentCleaner {
  /**
   * Preprocess and clean raw text extracted from PDF / DOCX
   * @param {string} rawText 
   * @returns {string} Cleaned document text
   */
  cleanText(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';

    let text = rawText;

    // Standardize newlines
    text = text.replace(/\r\n|\r/g, '\n');

    // Replace non-breaking spaces and form-feeds
    text = text.replace(/\u00A0/g, ' ');
    text = text.replace(/\f/g, '\n\n');

    // Standardize smart quotes and typographic dashes
    text = text
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-');

    // Rejoin hyphenated line breaks (e.g. "conversa-\ntion" -> "conversation")
    text = text.replace(/([a-zA-Z]{2,})-\n\s*([a-zA-Z]{2,})/g, '$1$2');

    // Standardize bullet points to "• "
    text = text.replace(/^[ \t]*[•\*\-▪►✔o]\s+/gm, '• ');

    // Normalize multiple spaces within a line (preserve newlines)
    const lines = text.split('\n').map(line => line.replace(/[ \t]{2,}/g, ' ').trim());
    text = lines.join('\n');

    // Reduce excessive newlines (max 2 consecutive newlines)
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
  }

  /**
   * Identifies the page number for a given text snippet or index in the document
   * Searches for preceding [Page X] or Page X markers.
   * @param {string} fullText 
   * @param {string|number} target - text snippet or char index
   * @returns {number|null}
   */
  findSourcePage(fullText, target) {
    if (!fullText) return null;
    let index = -1;
    if (typeof target === 'number') {
      index = target;
    } else if (typeof target === 'string' && target.length > 0) {
      index = fullText.indexOf(target.slice(0, 50));
    }
    if (index === -1) return null;

    const precedingText = fullText.slice(0, index);
    const matches = [...precedingText.matchAll(/\[Page\s*(\d+)\]|Page\s*(\d+)\s+of\s+\d+|---\s*Page\s*(\d+)\s*---/gi)];
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const pageNum = parseInt(lastMatch[1] || lastMatch[2] || lastMatch[3], 10);
      if (!isNaN(pageNum) && pageNum > 0) return pageNum;
    }
    return null;
  }

  /**
   * Identifies the nearest section or heading for a given text snippet
   * @param {string} fullText 
   * @param {string} snippet 
   * @returns {string|null}
   */
  findNearestSection(fullText, snippet) {
    if (!fullText || !snippet) return null;
    const index = fullText.indexOf(snippet.slice(0, 40));
    if (index === -1) return null;

    const precedingText = fullText.slice(0, index);
    const lines = precedingText.split('\n').map(l => l.trim()).filter(Boolean);

    // Scan backwards from snippet to find heading-like line
    const sectionPattern = /^(?:Part\s+[A-Z]|\d+\.\s+[A-Z][^\n]{3,60}|Section\s+\d+|ARTICLE\s+[IVX\d]+|CLAUSE\s+\d+|[A-Z\s]{4,40}:)/i;
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 20); i--) {
      const line = lines[i];
      if (sectionPattern.test(line) && line.length < 70) {
        return line.replace(/[:\-_]+$/, '').trim();
      }
    }
    return null;
  }
}

module.exports = new DocumentCleaner();
