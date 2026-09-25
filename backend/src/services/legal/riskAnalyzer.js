/**
 * Risk & Red Flag Analyzer for Legal, Insurance, and Commercial Documents.
 * Detects material contractual risks grounded in verifiable source text.
 * Never returns generic "fairness" platitudes.
 */

const documentCleaner = require('./documentCleaner');

class RiskAnalyzer {
  /**
   * Analyze document text for grounded risks and red flags
   * @param {string} text - Cleaned document text
   * @param {string} category - Document category
   * @returns {Array<Object>} List of structured red flags
   */
  analyzeRisks(text, category = 'General Contract / Agreement') {
    if (!text || typeof text !== 'string') return [];

    const risks = [];
    const seenTitles = new Set();

    const riskScanners = [
      {
        title: 'Suicide Exclusion Restriction',
        severity: 'high',
        triggerRegex: /(?:suicide\s+(?:whether\s+sane\s+or\s+insane|exclusion)|in\s+case\s+of\s+death\s+due\s+to\s+suicide)[\s\S]{0,150}?(?:within\s+12\s+months|not\s+be\s+payable|only\s+(?:80%|total\s+premiums))/i,
        explanation: 'Death benefit is denied if death results from suicide within 12 months of policy inception or revival.',
        consequences: 'Nominees receive only total premiums paid or surrender value (if accrued) rather than the full guaranteed death benefit.'
      },
      {
        title: 'Policy Lapse on Missed Premium',
        severity: 'high',
        triggerRegex: /(?:non[\-\s]?payment\s+of\s+premium|policy\s+shall\s+lapse|lapse\s+without\s+value)[\s\S]{0,150}?(?:grace\s+period|all\s+benefits\s+shall\s+cease|forfeited)/i,
        explanation: 'Failing to pay renewal premiums within the statutory grace period causes the policy to lapse.',
        consequences: 'Complete cessation of insurance risk cover and forfeiture of paid premiums if minimum term has not accrued.'
      },
      {
        title: 'Early Surrender Financial Loss',
        severity: 'medium',
        triggerRegex: /(?:surrender\s+value|early\s+surrender|discontinuance)[\s\S]{0,150}?(?:less\s+than\s+total\s+premiums|surrender\s+charge|penalty\s+deduction)/i,
        explanation: 'Surrendering a savings or life insurance policy in early years typically yields a fraction of total premiums paid.',
        consequences: 'Severe financial loss compared to total capital invested if the policyholder exits prematurely.'
      },
      {
        title: 'Outstanding Loan Foreclosure',
        severity: 'medium',
        triggerRegex: /(?:foreclosure|outstanding\s+loan\s+together\s+with\s+interest)[\s\S]{0,150}?(?:exceeds\s+the\s+surrender\s+value|policy\s+shall\s+be\s+terminated)/i,
        explanation: 'If total outstanding loan advances and accrued interest exceed the policy surrender value, the insurer can terminate the policy.',
        consequences: 'Immediate termination of policy without further benefit payments to recover outstanding loan debt.'
      },
      {
        title: 'Section 45 Fraud / Misstatement Repudiation',
        severity: 'high',
        triggerRegex: /(?:Section\s+45\s+of\s+the\s+Insurance\s+Act|fraud\s+and\s+misstatement|non[\-\s]?disclosure\s+of\s+material\s+fact)[\s\S]{0,150}?(?:repudiate|called\s+in\s+question|void)/i,
        explanation: 'Misstating age, health history, or material personal facts allows the insurer to contest claims within statutory timeframes.',
        consequences: 'Repudiation of claims, cancellation of policy, and potential forfeiture of premiums paid.'
      },
      {
        title: 'Mandatory Binding Arbitration',
        severity: 'medium',
        triggerRegex: /(?:binding\s+arbitration|shall\s+be\s+referred\s+to\s+arbitration|arbitral\s+tribunal)[\s\S]{0,150}?(?:waive\s+court|exclusive\s+remedy|no\s+right\s+to\s+trial)/i,
        explanation: 'Disputes are barred from public courts and must be resolved through binding private arbitration.',
        consequences: 'High private arbitration costs and limited appellate review if an adverse award is rendered.'
      },
      {
        title: 'Post-Employment Non-Compete Restraint',
        severity: 'high',
        triggerRegex: /(?:non[\-\s]?compete|covenant\s+not\s+to\s+compete|restraint\s+of\s+trade)[\s\S]{0,150}?(?:shall\s+not\s+(?:engage|work|solicit)|for\s+a\s+period\s+of\s+\d+\s+months)/i,
        explanation: 'Restricts employee or contractor from working with competitors or in the same industry post-termination.',
        consequences: 'Limits future employment opportunities and carries risk of legal action or injunction.'
      },
      {
        title: 'Broad Unilateral Indemnification',
        severity: 'high',
        triggerRegex: /(?:shall\s+indemnify|hold\s+harmless|defend\s+and\s+indemnify)[\s\S]{0,150}?(?:against\s+all\s+losses|indirect|consequential|all\s+claims)/i,
        explanation: 'Requires one party to compensate the other for broad third-party claims, legal fees, or indirect losses.',
        consequences: 'Uncapped financial liability exposure extending beyond the base contractual value.'
      },
      {
        title: 'Auto-Renewal without Prior Notice',
        severity: 'medium',
        triggerRegex: /(?:renews?\s+automatically|auto[\-\s]?renewal)[\s\S]{0,150}?(?:unless\s+cancelled|notice\s+prior|automatic\s+extension)/i,
        explanation: 'The contract automatically extends for subsequent terms unless timely cancellation notice is submitted.',
        consequences: 'Unintended lock-in to additional contract periods and associated financial commitments.'
      }
    ];

    for (const rs of riskScanners) {
      const match = rs.triggerRegex.exec(text);
      if (match) {
        const snippetStart = Math.max(0, match.index - 30);
        const snippetEnd = Math.min(text.length, match.index + match[0].length + 150);
        const sourceText = text.slice(snippetStart, snippetEnd).replace(/\s+/g, ' ').trim();

        const key = rs.title.toLowerCase();
        if (!seenTitles.has(key)) {
          seenTitles.add(key);
          const page = documentCleaner.findSourcePage(text, match.index);
          const section = documentCleaner.findNearestSection(text, sourceText);
          risks.push({
            title: rs.title,
            severity: rs.severity,
            explanation: rs.explanation,
            risk: rs.explanation, // For frontend AnalysisResultPage.jsx
            consequences: rs.consequences,
            source_text: sourceText,
            excerpt: sourceText, // For frontend AnalysisResultPage.jsx
            page,
            section
          });
        }
      }
    }

    return risks;
  }
}

module.exports = new RiskAnalyzer();
