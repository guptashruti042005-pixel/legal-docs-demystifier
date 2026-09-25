/**
 * Financial Obligations & Metrics Extractor for Legal, Insurance, and Commercial Documents.
 * Extracts premiums, sum assured, benefits, surrender values, fees, penalties, and interest rates.
 * Supports source traceability (page and section).
 */

const documentCleaner = require('./documentCleaner');

class FinancialExtractor {
  /**
   * Extract financial commitments and payout metrics from text
   * @param {string} text - Cleaned document text
   * @param {string} category - Document category
   * @returns {Array<Object>} List of structured financial obligations
   */
  extractFinancials(text, category = 'General Contract / Agreement') {
    if (!text || typeof text !== 'string') return [];

    const results = [];
    const seenKeys = new Set();

    // Contextual Financial Patterns
    const patterns = [
      {
        type: 'Maturity Benefit',
        regex: /(?:Guaranteed\s+Sum\s+Assured\s+on\s+Maturity|Maturity\s+Benefit)(?:[^.\n]{0,80})?(?:plus\s+Guaranteed\s+Addition|payable\s+on\s+Maturity\s+Date)?/i,
        unit: 'Lump Sum Payout',
        description: 'Guaranteed payout upon policy maturity plus applicable guaranteed additions.'
      },
      {
        type: 'Death Benefit',
        regex: /(?:Death\s+Benefit\s+payable|Sum\s+Assured\s+on\s+Death)(?:[^.\n]{0,120})?(?:highest\s+of|10\s+times|105%\s+of\s+total\s+premiums|sum\s+assured)/i,
        unit: 'Lump Sum Payout',
        description: 'Financial protection payout to nominees upon life assured death during the policy term.'
      },
      {
        type: 'Premium Obligation',
        regex: /(?:Regular\s+Premiums|Modal\s+Premium|annualized\s+premium|premium\s+payable)(?:[^.\n]{0,80})?(?:yearly|half[\-\s]yearly|quarterly|monthly|instalment)?/i,
        unit: 'Scheduled Payment',
        description: 'Scheduled premium installments payable to maintain full policy coverage.'
      },
      {
        type: 'Guaranteed Surrender Value',
        regex: /(?:Guaranteed\s+Surrender\s+Value|GSV)(?:[^.\n]{0,100})?(?:percentage\s+of\s+total\s+premiums|surrender\s+value\s+factor)/i,
        unit: 'Percentage / Factor',
        description: 'Statutory minimum cash value receivable upon early surrender of the policy after lock-in.'
      },
      {
        type: 'Policy Loan Facility',
        regex: /(?:policy\s+loan|loan\s+against\s+policy)(?:[^.\n]{0,80})?(?:up\s+to\s+\d+%\s+of\s+surrender\s+value|interest\s+rate|compounded\s+half[\-\s]yearly)?/i,
        unit: 'Credit Facility',
        description: 'Right to borrow against accrued surrender value subject to applicable interest rates.'
      },
      {
        type: 'Compensation / Salary',
        regex: /(?:base\s+salary|fixed\s+compensation|annual\s+ctc|remuneration)(?:[^.\n]{0,80})?(?:INR|₹|\$|USD|\bper\s+annum\b|\bper\s+month\b)/i,
        unit: 'Salary',
        description: 'Base remuneration payable for employment services.'
      },
      {
        type: 'Monthly Rent',
        regex: /(?:monthly\s+rent|rent\s+amount|license\s+fee)(?:[^.\n]{0,80})?(?:INR|₹|\$|USD|\bper\s+month\b|\bdue\s+on\b)/i,
        unit: 'Monthly Lease',
        description: 'Periodic rental consideration for premises occupancy.'
      },
      {
        type: 'Security Deposit',
        regex: /(?:security\s+deposit|interest[\-\s]?free\s+deposit)(?:[^.\n]{0,80})?(?:refundable|months?\s+rent)/i,
        unit: 'Refundable Deposit',
        description: 'Collateral deposit held by lessor, refundable upon lease expiration.'
      },
      {
        type: 'Late Payment / Penalty Charge',
        regex: /(?:late\s+fee|penalty\s+interest|interest\s+at\s+(?:\d{1,2}(?:\.\d+)?%|rate\s+of)|penal\s+charge)/i,
        unit: 'Percentage / Fee',
        description: 'Additional financial fee incurred for delayed payment or default.'
      }
    ];

    for (const p of patterns) {
      let match;
      const regex = new RegExp(p.regex.source, p.regex.flags + (p.regex.global ? '' : 'g'));
      while ((match = regex.exec(text)) !== null) {
        const snippetStart = Math.max(0, match.index - 30);
        const snippetEnd = Math.min(text.length, match.index + match[0].length + 150);
        const sourceText = text.slice(snippetStart, snippetEnd).replace(/\s+/g, ' ').trim();

        // Extract any specific value or percentage if present
        const valMatch = sourceText.match(/(?:₹|rs\.?|inr|\$|usd|eur|gbp)\s?[\d,]+(?:\.\d+)?|\b\d{1,3}(?:\.\d+)?%/i);
        const valueStr = valMatch ? valMatch[0] : (p.unit || 'As defined in contract terms');

        const key = p.type.toLowerCase();
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const page = documentCleaner.findSourcePage(text, match.index);
          const section = documentCleaner.findNearestSection(text, sourceText);
          results.push({
            type: p.type,
            value: valueStr,
            amount: valueStr, // For frontend AnalysisResultPage.jsx table
            unit: p.unit,
            description: p.description,
            source_text: sourceText,
            terms: sourceText, // For frontend AnalysisResultPage.jsx table
            page,
            section
          });
        }
      }
    }

    return results;
  }
}

module.exports = new FinancialExtractor();
