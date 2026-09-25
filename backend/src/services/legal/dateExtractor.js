/**
 * Contextual Date & Deadline Extractor for Legal, Financial, and Insurance Documents.
 * Suppresses phone numbers, table coordinates, serials, and UINs.
 * Extracts genuine calendar dates and contractual periods/deadlines.
 */

const documentCleaner = require('./documentCleaner');

class DateExtractor {
  /**
   * Helper to normalize spelled-out numbers like "five (5)" or "fifteen (15)"
   */
  _normalizePeriodString(rawStr, unit = 'days') {
    if (!rawStr) return '';
    const clean = rawStr.replace(/\s+/g, ' ').trim();
    if (/\bfifteen\b|\b15\b/i.test(clean) && /\bthirty\b|\b30\b/i.test(clean)) {
      return '15 to 30 days';
    }
    const parenMatch = clean.match(/\((\d+)\)/);
    if (parenMatch) {
      return `${parenMatch[1]} ${unit}`;
    }
    const numMatch = clean.match(/\b\d+\b/);
    if (numMatch) {
      return `${numMatch[0]} ${unit}`;
    }
    return clean;
  }

  /**
   * Extract validated dates and deadlines from document text
   * @param {string} text - Cleaned document text
   * @returns {Array<Object>} List of structured dates
   */
  extractDates(text) {
    if (!text || typeof text !== 'string') return [];

    const results = [];
    const seenEntries = new Set();

    // 1. Detect Contractual Periods & Deadlines from Context
    const periodScanners = [
      {
        regex: /(?:free[\-\s]?look(?:\s+period)?)[^\.\n]{0,80}?(?:of\s+)?((?:\d{1,3}|fifteen(?:\s*\(15\))?|thirty(?:\s*\(30\))?)\s+days?)/i,
        significance: 'Free Look Cancellation Period',
        defaultUnit: 'days',
        impact: 'Permits policy return and full premium refund (less statutory deductions) if terms are unacceptable.'
      },
      {
        regex: /(?:grace\s+period)[^\.\n]{0,120}?(?:of\s+)?((?:fifteen(?:\s*\(15\))?|15)\s*days?(?:[^\.\n]{0,60}?(?:thirty(?:\s*\(30\))?|30)\s*days?)?|\d{1,3}\s+days?)/i,
        significance: 'Premium Payment Grace Period',
        defaultUnit: 'days',
        impact: 'Window (15 days for monthly, 30 days for other frequencies) to pay overdue premium without coverage lapse.'
      },
      {
        regex: /(?:revival\s+period)[^\.\n]{0,80}?(?:of\s+)?((?:\d{1,2}|five(?:\s*\(5\))?|three(?:\s*\(3\))?|two(?:\s*\(2\))?)\s*(?:consecutive\s+)?(?:years?|months?))/i,
        significance: 'Policy Revival Window',
        defaultUnit: 'years',
        impact: 'Timeframe within which a lapsed or paid-up policy can be reinstated.'
      },
      {
        regex: /(?:waiting\s+period)[^\.\n]{0,80}?(?:of\s+)?((?:\d{1,3}|ninety(?:\s*\(90\))?)\s*(?:days?|months?|years?))/i,
        significance: 'Waiting Period',
        defaultUnit: 'days',
        impact: 'Claims arising during this period are excluded or subject to restricted benefits.'
      },
      {
        regex: /(?:suicide(?:\s+exclusion)?)[^\.\n]{0,80}?(?:within\s+)?((?:\d{1,2}|twelve(?:\s*\(12\))?|one(?:\s*\(1\))?)\s*(?:months?|years?))/i,
        significance: 'Suicide Exclusion Period',
        defaultUnit: 'months',
        impact: 'Death benefit is excluded if suicide occurs within this timeframe from inception or revival.'
      },
      {
        regex: /(?:notice\s+period(?:\s+of)?|notice\s+of)\s+(\d{1,3}\s+(?:business\s+)?(?:days?|weeks?|months?))\s+(?:prior|before|in\s+writing)/i,
        significance: 'Termination Notice Period',
        defaultUnit: 'days',
        impact: 'Mandatory written notice duration required before ending the agreement.'
      },
      {
        regex: /(?:lock[\-\s]?in\s+period(?:\s+of)?)\s+(\d{1,2}\s+(?:months?|years?))/i,
        significance: 'Lock-in Commitment Period',
        defaultUnit: 'months',
        impact: 'Neither party may terminate or surrender without incurring financial forfeiture.'
      }
    ];

    for (const ps of periodScanners) {
      let match;
      const regex = new RegExp(ps.regex.source, ps.regex.flags + (ps.regex.global ? '' : 'g'));
      while ((match = regex.exec(text)) !== null) {
        const rawPeriod = match[1] ? match[1].trim() : match[0].trim();
        const periodStr = this._normalizePeriodString(rawPeriod, ps.defaultUnit);
        const snippetStart = Math.max(0, match.index - 40);
        const snippetEnd = Math.min(text.length, match.index + match[0].length + 120);
        const sourceText = text.slice(snippetStart, snippetEnd).replace(/\s+/g, ' ').trim();

        const key = `${ps.significance}_${periodStr}`.toLowerCase();
        if (!seenEntries.has(key)) {
          seenEntries.add(key);
          const page = documentCleaner.findSourcePage(text, match.index);
          const section = documentCleaner.findNearestSection(text, sourceText);
          results.push({
            date_or_period: periodStr,
            date: periodStr,
            significance: ps.significance,
            description: ps.significance,
            impact: ps.impact,
            source_text: sourceText,
            page,
            section
          });
        }
      }
    }

    // 2. Detect Legitimate Calendar Dates with Strict Context & Range Validation
    const calendarDateRegex = /\b(\d{1,2})(?:st|nd|rd|th)?[\s\/\-\.]([A-Za-z]+|\d{1,2})[\s\/\-\.](\d{2,4})\b/g;
    let calMatch;

    while ((calMatch = calendarDateRegex.exec(text)) !== null) {
      const fullMatch = calMatch[0];
      const matchIndex = calMatch.index;

      // Anti-pattern 1: Check preceding and succeeding text for phone / contact / code indicators
      const windowBefore = text.slice(Math.max(0, matchIndex - 60), matchIndex);
      const windowAfter = text.slice(matchIndex + fullMatch.length, Math.min(text.length, matchIndex + fullMatch.length + 30));

      if (/tel|telephone|phone|fax|mob(?:ile)?|uin|cin|pin(?:code)?|code|annexe|reg(?:n)?\.?|floor|road|street/i.test(windowBefore)) {
        continue; // Phone number or postal contact info
      }

      // Anti-pattern 2: Multiple consecutive slashes (e.g. "69038821/23/24/ 25/26/27/28/28/29")
      if (/[\/\-]\s*\d{1,2}[\/\-]/.test(windowBefore) || /[\/\-]\s*\d{1,2}/.test(windowAfter)) {
        continue; // Slash sequence in extension list or phone number
      }

      // Anti-pattern 3: Verify day, month, year ranges
      const p1 = calMatch[1];
      const p2 = calMatch[2];
      const p3 = calMatch[3];

      let day, month, year;
      const monthNames = {
        jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
        may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, september: 9,
        oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
      };

      if (isNaN(p2)) {
        const mKey = p2.toLowerCase();
        if (!monthNames[mKey]) continue;
        day = parseInt(p1, 10);
        year = parseInt(p3, 10);
        if (day < 1 || day > 31) continue;
        if (year < 1950 || year > 2050) continue;
      } else {
        const v1 = parseInt(p1, 10);
        const v2 = parseInt(p2, 10);
        year = parseInt(p3, 10);

        if (year < 100) year += 2000;
        if (year < 1980 || year > 2060) continue;

        const isDDMM = v1 >= 1 && v1 <= 31 && v2 >= 1 && v2 <= 12;
        const isMMDD = v1 >= 1 && v1 <= 12 && v2 >= 1 && v2 <= 31;
        if (!isDDMM && !isMMDD) continue;
      }

      const sentenceStart = Math.max(0, matchIndex - 80);
      const sentenceEnd = Math.min(text.length, matchIndex + fullMatch.length + 100);
      const surroundingSentence = text.slice(sentenceStart, sentenceEnd).replace(/\s+/g, ' ').trim();

      let dateSignificance = 'Contract Schedule Marker';
      let dateImpact = 'Operative milestone in agreement.';

      if (/effective|commence|inception|start/i.test(surroundingSentence)) {
        dateSignificance = 'Policy / Contract Commencement Date';
        dateImpact = 'Coverage and contractual rights officially become active.';
      } else if (/matur|expiry|end\s+date|terminat/i.test(surroundingSentence)) {
        dateSignificance = 'Maturity / Expiration Date';
        dateImpact = 'Date on which policy term ends or benefits mature.';
      } else if (/due\s+date|renewal/i.test(surroundingSentence)) {
        dateSignificance = 'Premium / Payment Due Date';
        dateImpact = 'Scheduled date for payment remittance.';
      } else {
        continue;
      }

      const key = `${fullMatch}_${dateSignificance}`.toLowerCase();
      if (!seenEntries.has(key)) {
        seenEntries.add(key);
        const page = documentCleaner.findSourcePage(text, matchIndex);
        const section = documentCleaner.findNearestSection(text, surroundingSentence);
        results.push({
          date_or_period: fullMatch,
          date: fullMatch,
          significance: dateSignificance,
          description: dateSignificance,
          impact: dateImpact,
          source_text: surroundingSentence,
          page,
          section
        });
      }
    }

    return results;
  }
}

module.exports = new DateExtractor();
