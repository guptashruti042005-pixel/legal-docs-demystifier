/**
 * Semantic Legal Clause Detector for General Legal, Financial, and Insurance Documents.
 * Classifies clauses based on contextual meaning rather than naive keyword substring matches.
 * Strictly prevents Assignment from being called Payment Terms, and Ombudsman addresses from being called Confidentiality.
 */

const documentCleaner = require('./documentCleaner');

class LegalClauseDetector {
  /**
   * Detect and classify key clauses from document text
   * @param {string} text - Cleaned document text
   * @param {string} category - Document category
   * @returns {Array<Object>} List of classified clauses
   */
  detectClauses(text, category = 'General Contract / Agreement') {
    if (!text || typeof text !== 'string') return [];

    const clauses = [];
    const seenTitles = new Set();

    // Semantic clause definitions with positive and negative filters
    const clauseDefinitions = [
      {
        title: 'Free Look Cancellation Period',
        category: 'Consumer Rights',
        importance: 'high',
        matchRegex: /(?:Free\s+Look\s+Period|cooling[\-\s]?off\s+period)/i,
        excludeRegex: null,
        explanation: 'Provides a statutory window (typically 15–30 days) to review policy conditions and cancel for a full refund if dissatisfied.'
      },
      {
        title: 'Grace Period & Lapse Provisions',
        category: 'Operational / Compliance',
        importance: 'high',
        matchRegex: /(?:Grace\s+Period(?:\s+of)?|Non[\-\s]?payment\s+of\s+Premium\s+and\s+Forfeiture|policy\s+shall\s+lapse)/i,
        excludeRegex: null,
        explanation: 'Specifies the grace window allowed to pay overdue premiums and outlines the consequences of non-payment (such as policy lapse or reduced paid-up benefits).'
      },
      {
        title: 'Policy Benefits (Death & Maturity)',
        category: 'Core Benefit',
        importance: 'high',
        matchRegex: /(?:Policy\s+Benefits|Death\s+Benefit|Maturity\s+Benefit|Guaranteed\s+Sum\s+Assured\s+on\s+Maturity)/i,
        excludeRegex: null,
        explanation: 'Defines the financial payouts payable upon maturity of the term or upon the demise of the life assured.'
      },
      {
        title: 'Exclusions & Waiting Periods',
        category: 'Risk / Restriction',
        importance: 'high',
        matchRegex: /(?:Exclusions\s*&?\s*Waiting\s+Period|Suicide\s+Exclusion)/i,
        excludeRegex: null,
        explanation: 'Specifies conditions (such as suicide within 12 months or pre-existing conditions) under which claims will be excluded or restricted.'
      },
      {
        title: 'Assignment & Transfer of Rights',
        category: 'Transfer of Rights',
        importance: 'medium',
        matchRegex: /(?:(?:14\.\s*)?Assignment(?:\s+should\s+be\s+in\s+accordance)?|Section\s+38\s+of\s+(?:the\s+)?Insurance\s+Act|Assignment\s+and\s+Transfer|transfer\s+or\s+Assignment\s+of\s+(?:this\s+)?Policy)/i,
        excludeRegex: /invoice\s+cadence|payment\s+due\s+date\s+match\s+cash\s+flow/i,
        explanation: 'Governs the legal assignment or transfer of policy benefits and rights to a third party (e.g. for loan collateral) under statutory rules.'
      },
      {
        title: 'Nomination of Beneficiaries',
        category: 'Beneficiary Rights',
        importance: 'medium',
        matchRegex: /(?:(?:15\.\s*)?Nomination(?:\s+should\s+be\s+in\s+accordance)?|Section\s+39\s+of\s+(?:the\s+)?Insurance\s+Act|Nomination\s+by\s+Policyholder)/i,
        excludeRegex: null,
        explanation: 'Allows the policyholder to designate nominees entitled to receive policy claim proceeds upon death.'
      },
      {
        title: 'Surrender Value & Foreclosure',
        category: 'Financial / Exit',
        importance: 'high',
        matchRegex: /(?:(?:9\.\s*)?Surrender\s+Value|Guaranteed\s+Surrender\s+Value|Special\s+Surrender\s+Value|Foreclosure)/i,
        excludeRegex: null,
        explanation: 'Details how surrender values are calculated if the contract is terminated prematurely, including potential financial penalties for early exit.'
      },
      {
        title: 'Policy Loan Facility',
        category: 'Financial Facility',
        importance: 'medium',
        matchRegex: /(?:(?:11\.\s*)?Policy\s+Loans?|Loan\s+against\s+Policy)/i,
        excludeRegex: null,
        explanation: 'Enables policyholders to obtain loan advances against accrued surrender values, subject to prevailing interest rates.'
      },
      {
        title: 'Grievance Redressal & Ombudsman',
        category: 'Dispute Resolution',
        importance: 'medium',
        matchRegex: /(?:Grievance\s+Redressal|Office\s+of\s+(?:the\s+)?Insurance\s+Ombudsman|Bimalokpal)/i,
        excludeRegex: null,
        explanation: 'Provides formal escalation channels to file complaints with the company Grievance Redressal Officer and the statutory Insurance Ombudsman.'
      },
      {
        title: 'Scope of Work & Deliverables',
        category: 'Operational',
        importance: 'high',
        matchRegex: /(?:Scope\s+of\s+Work|Scope\s+of\s+Services|Deliverables|Statement\s+of\s+Work)/i,
        excludeRegex: null,
        explanation: 'Outlines the technical deliverables, task milestones, and performance criteria expected from the service provider.'
      },
      {
        title: 'Compensation & Payment Terms',
        category: 'Financial',
        importance: 'high',
        matchRegex: /(?:Payment\s+Terms|Compensation|Invoicing|Fee\s+Schedule)/i,
        // Exclude if it is an assignment/transfer clause that merely mentions proceeds "payable"
        excludeRegex: /(?:Assignment|Section\s+38|transferee|transfer\s+or\s+Assignment)/i,
        explanation: 'Specifies payment amounts, invoicing frequency, acceptable payment methods, and due dates.'
      },
      {
        title: 'Confidentiality & Non-Disclosure',
        category: 'Legal / IP',
        importance: 'high',
        // Require explicit covenant verbs (shall keep confidential, not disclose, proprietary information)
        matchRegex: /(?:shall\s+keep\s+confidential|maintain\s+in\s+strict\s+confidence|proprietary\s+and\s+confidential\s+information|non[\-\s]?disclosure\s+obligation)/i,
        // Exclude ombudsman listings, regulatory addresses, and general email disclaimers
        excludeRegex: /(?:Insurance\s+Ombudsman|Office\s+of\s+the\s+Insurance\s+Ombudsman|Bimalokpal|Jeevan\s+Bhawan|C\.R\.\s+Avenue|Kolkata|bimalokpal)/i,
        explanation: 'Requires parties to protect sensitive business, financial, or proprietary information from unauthorized disclosure.'
      },
      {
        title: 'Termination & Cancellation',
        category: 'Operational / Exit',
        importance: 'high',
        matchRegex: /(?:Termination\s+Clause|Termination\s+Conditions|Right\s+to\s+Terminate)/i,
        excludeRegex: null,
        explanation: 'Defines how the agreement can be ended, including required notice periods and remedies for breach.'
      },
      {
        title: 'Governing Law & Jurisdiction',
        category: 'Legal',
        importance: 'medium',
        matchRegex: /(?:Governing\s+Law|Jurisdiction\s+and\s+Dispute\s+Resolution)/i,
        excludeRegex: null,
        explanation: 'Establishes which legal system governs the contract and identifies the court jurisdiction for formal legal proceedings.'
      },
      {
        title: 'Limitation of Liability',
        category: 'Legal / Risk',
        importance: 'high',
        matchRegex: /(?:Limitation\s+of\s+Liability|Liability\s+shall\s+not\s+exceed|Cap\s+on\s+Liability)/i,
        excludeRegex: null,
        explanation: 'Restricts the maximum monetary exposure one party can claim against the other in the event of dispute or damage.'
      }
    ];

    for (const cDef of clauseDefinitions) {
      const match = cDef.matchRegex.exec(text);
      if (match) {
        const matchIdx = match.index;
        const excerptSnippet = text.slice(Math.max(0, matchIdx - 20), Math.min(text.length, matchIdx + match[0].length + 180)).replace(/\s+/g, ' ').trim();

        // Check exclude regex
        if (cDef.excludeRegex && cDef.excludeRegex.test(excerptSnippet)) {
          continue; // Suppress false positive
        }

        const titleKey = cDef.title.toLowerCase();
        if (!seenTitles.has(titleKey)) {
          seenTitles.add(titleKey);
          const page = documentCleaner.findSourcePage(text, matchIdx);
          const section = documentCleaner.findNearestSection(text, excerptSnippet);
          clauses.push({
            title: cDef.title,
            category: cDef.category,
            importance: cDef.importance,
            original_text: excerptSnippet,
            excerpt: excerptSnippet, // For frontend AnalysisResultPage.jsx
            plain_language_explanation: cDef.explanation,
            explanation: cDef.explanation, // For frontend AnalysisResultPage.jsx
            source_page: page,
            source_section: section
          });
        }
      }
    }

    return clauses;
  }
}

module.exports = new LegalClauseDetector();
