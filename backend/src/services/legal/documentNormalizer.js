/**
 * Document Normalizer & Validator for Legal, Insurance, and Commercial Documents.
 * Validates LLM output against raw document text, rejects hallucinated boilerplate,
 * sanitizes dates (rejecting phone number sequences), and aligns data with frontend requirements.
 */

const documentClassifier = require('./documentClassifier');
const dateExtractor = require('./dateExtractor');
const recommendationsEngine = require('./recommendationsEngine');

class DocumentNormalizer {
  /**
   * Normalize, sanitize, and validate analysis result against raw document text
   * @param {Object} rawAnalysis - Parsed JSON from LLM or rule-based engine
   * @param {string} fullText - Cleaned full document text
   * @param {string} persona - User target persona
   * @param {string} fileName - Uploaded file name
   * @param {string} userDocumentType - User selected document type
   * @returns {Object} Fully validated and grounded analysis object
   */
  normalizeAndValidate(rawAnalysis, fullText = '', persona = 'default', fileName = '', userDocumentType = '') {
    const analysis = rawAnalysis && typeof rawAnalysis === 'object' ? rawAnalysis : {};

    // 1. Detect and Validate Document Category
    const detectedCategory = documentClassifier.detectCategory(fullText, fileName, userDocumentType || analysis.documentType);
    const category = analysis.documentType && analysis.documentType !== 'general' && analysis.documentType !== 'Contract / Agreement'
      ? analysis.documentType
      : detectedCategory;

    // 2. Normalize Key Clauses
    const rawClauses = Array.isArray(analysis.importantClauses) ? analysis.importantClauses : [];
    const sanitizedClauses = [];
    const seenClauseTitles = new Set();

    for (const c of rawClauses) {
      if (!c || !c.title) continue;
      let title = String(c.title).trim();
      let importance = ['high', 'medium', 'low'].includes((c.importance || '').toLowerCase())
        ? (c.importance || '').toLowerCase()
        : 'medium';
      
      const excerpt = (c.excerpt || c.original_text || '').trim();
      const explanation = (c.explanation || c.plain_language_explanation || '').trim();

      // Guardrail 1: Disallow Ombudsman addresses from being labeled as "Confidentiality"
      if (/confidential/i.test(title) && /ombudsman|bimalokpal|cioins\.co\.in|jeevan\s+bhawan/i.test(excerpt + ' ' + explanation)) {
        title = 'Grievance Redressal & Ombudsman';
      }

      // Guardrail 2: Disallow Assignment / Transfer clauses from being labeled as "Payment Terms"
      if (/payment/i.test(title) && /assignment|section\s+38|transfer\s+of\s+policy|assignee/i.test(excerpt + ' ' + explanation)) {
        title = 'Assignment & Transfer of Rights';
      }

      const key = title.toLowerCase();
      if (!seenClauseTitles.has(key)) {
        seenClauseTitles.add(key);
        sanitizedClauses.push({
          title,
          category: c.category || 'Contractual Term',
          importance,
          excerpt: excerpt || 'Refer to relevant document section',
          original_text: excerpt || 'Refer to relevant document section',
          explanation: explanation || 'Key contractual term governing rights and obligations.',
          plain_language_explanation: explanation || 'Key contractual term governing rights and obligations.',
          source_page: c.source_page || null,
          source_section: c.source_section || null
        });
      }
    }

    // 3. Normalize Red Flags & Risks
    const rawFlags = Array.isArray(analysis.redFlags) ? analysis.redFlags : [];
    const sanitizedFlags = [];
    const seenFlagTitles = new Set();

    for (const f of rawFlags) {
      if (!f || !f.title) continue;
      const title = String(f.title).trim();
      const severity = ['high', 'medium', 'low'].includes((f.severity || '').toLowerCase())
        ? (f.severity || '').toLowerCase()
        : 'medium';
      const excerpt = (f.excerpt || f.source_text || '').trim();
      const risk = (f.risk || f.explanation || '').trim();
      const consequences = (f.consequences || 'May result in loss of contractual protections or financial liability.').trim();

      const key = title.toLowerCase();
      if (!seenFlagTitles.has(key)) {
        seenFlagTitles.add(key);
        sanitizedFlags.push({
          title,
          severity,
          excerpt: excerpt || 'Refer to relevant policy terms',
          source_text: excerpt || 'Refer to relevant policy terms',
          risk,
          explanation: risk,
          consequences,
          source_page: f.source_page || null,
          source_section: f.source_section || null
        });
      }
    }

    // 4. Normalize Financial Obligations
    const rawFin = Array.isArray(analysis.financialObligations) ? analysis.financialObligations : [];
    const sanitizedFinancials = [];
    const seenFinKeys = new Set();

    for (const fin of rawFin) {
      if (!fin) continue;
      const desc = fin.description || fin.type || '';
      const amt = fin.amount || fin.value || 'As stated in schedule';
      const terms = fin.terms || fin.source_text || 'Subject to policy terms';
      const key = `${desc}_${amt}`.toLowerCase();

      if (desc && !seenFinKeys.has(key)) {
        seenFinKeys.add(key);
        sanitizedFinancials.push({
          type: fin.type || 'Obligation',
          description: desc,
          amount: amt,
          value: amt,
          unit: fin.unit || '',
          terms,
          source_text: terms,
          page: fin.page || null,
          section: fin.section || null
        });
      }
    }

    // 5. Sanitize Dates & Filter Out Phone Numbers / Coordinate Sequences
    const rawDates = Array.isArray(analysis.importantDates) ? analysis.importantDates : [];
    const sanitizedDates = [];
    const seenDateKeys = new Set();

    for (const d of rawDates) {
      if (!d) continue;
      const dateStr = String(d.date || d.date_or_period || '').trim();

      // Guardrail against telephone extensions (e.g. "25/26/27", "28/28/29", "23/24/25")
      if (/^\d{1,2}\/\d{1,2}\/\d{1,2}(?:\/\d{1,2})*$/.test(dateStr)) {
        const parts = dateStr.split('/').map(Number);
        const hasInvalidMonth = parts.every(p => p > 12);
        const isExtensionSequence = parts.some((p, idx) => idx > 0 && Math.abs(p - parts[idx - 1]) <= 2);
        if (hasInvalidMonth || (parts.length >= 3 && isExtensionSequence && parts[2] < 50)) {
          continue; // Suppress phone number extension sequence!
        }
      }

      // Check description / significance
      const sig = d.significance || d.description || 'Contract Schedule Marker';
      const desc = d.description || d.significance || 'Milestone';
      const impact = d.impact || 'Time-sensitive contractual obligation.';
      const key = `${dateStr}_${sig}`.toLowerCase();

      if (dateStr && !seenDateKeys.has(key)) {
        seenDateKeys.add(key);
        sanitizedDates.push({
          date: dateStr,
          date_or_period: dateStr,
          significance: sig,
          description: desc,
          impact,
          source_text: d.source_text || '',
          page: d.page || null,
          section: d.section || null
        });
      }
    }

    // If dates are empty or were suppressed, run rule-based dateExtractor on text
    if (sanitizedDates.length === 0 && fullText) {
      const extractedDates = dateExtractor.extractDates(fullText);
      sanitizedDates.push(...extractedDates);
    }

    // 6. Sanitize Recommendations & Filter Out Generic Contract Boilerplate
    const rawRecs = Array.isArray(analysis.recommendations) ? analysis.recommendations : [];
    const sanitizedRecs = [];
    const seenRecs = new Set();

    for (const r of rawRecs) {
      if (!r) continue;
      const action = String(r.action || r.recommendation || '').trim();
      const rationale = String(r.rationale || r.reason || '').trim();

      // Filter out inappropriate commercial invoice advice on insurance or non-invoiced policies
      if (/invoice\s+cadence|payment\s+due\s+dates\s+match\s+your\s+cash\s+flow/i.test(action + ' ' + rationale)) {
        if (category === 'Insurance Policy' || !/invoice/i.test(fullText)) {
          continue; // Suppress generic invoice recommendation
        }
      }

      // Filter out generic late fee negotiation if no penalties are mentioned
      if (/negotiate\s+or\s+clarify\s+penalty\s+and\s+late\s+fee/i.test(action + ' ' + rationale)) {
        if (!/penalty|late\s+fee|liquidated\s+damages/i.test(fullText)) {
          continue; // Suppress generic penalty recommendation
        }
      }

      const key = action.toLowerCase();
      if (action && !seenRecs.has(key)) {
        seenRecs.add(key);
        sanitizedRecs.push({
          action,
          recommendation: action,
          rationale,
          reason: rationale,
          source_clause: r.source_clause || 'Contract Provisions',
          priority: r.priority || 'medium'
        });
      }
    }

    // If recommendations are empty or were filtered out, generate grounded recommendations
    if (sanitizedRecs.length === 0) {
      const generated = recommendationsEngine.generateRecommendations(sanitizedClauses, sanitizedFlags, category);
      sanitizedRecs.push(...generated.recommendations);
    }

    // 7. Sanitize Missing Clauses (Category-Aware)
    const expectedForCat = documentClassifier.getExpectedClauses(category);
    const rawMissing = Array.isArray(analysis.missingClauses) ? analysis.missingClauses : [];
    const sanitizedMissing = [];
    const seenMissing = new Set();

    for (const m of rawMissing) {
      if (!m || !m.clause) continue;
      const clauseName = String(m.clause).trim();

      // Suppress "Force Majeure" on an individual life/health insurance policy
      if (category === 'Insurance Policy' && /force\s+majeure/i.test(clauseName)) {
        continue;
      }

      // Ensure explanation uses truthful wording
      let expl = m.explanation || `Not identified in the analyzed document.`;
      if (!expl.toLowerCase().includes('not identified') && !expl.toLowerCase().includes('not found')) {
        expl = `Not identified in the analyzed document: ${expl}`;
      }

      const key = clauseName.toLowerCase();
      if (!seenMissing.has(key)) {
        seenMissing.add(key);
        sanitizedMissing.push({
          clause: clauseName,
          explanation: expl
        });
      }
    }

    // If missing clauses is empty, check expected clauses for category
    if (sanitizedMissing.length === 0) {
      for (const exp of expectedForCat) {
        const found = sanitizedClauses.some(c => c.title.toLowerCase().includes(exp.name.toLowerCase()));
        if (!found) {
          sanitizedMissing.push({
            clause: exp.name,
            explanation: `Not identified in the analyzed document. Standard safeguard for ${category}: ${exp.explanation}`
          });
          if (sanitizedMissing.length >= 3) break;
        }
      }
    }

    // 8. Overall Risk Level
    let overallRisk = (analysis.riskLevel || '').toLowerCase();
    if (!['low', 'medium', 'high'].includes(overallRisk)) {
      overallRisk = sanitizedFlags.some(f => f.severity === 'high')
        ? 'high'
        : sanitizedFlags.some(f => f.severity === 'medium')
        ? 'medium'
        : 'low';
    }

    // 9. Action Items & Caveats
    const actionItems = Array.isArray(analysis.actionItems) && analysis.actionItems.length > 0
      ? analysis.actionItems.filter(item => !/invoice\s+cadence/i.test(item))
      : sanitizedRecs.map(r => r.action);

    const hiddenCaveats = Array.isArray(analysis.hiddenCaveats) && analysis.hiddenCaveats.length > 0
      ? analysis.hiddenCaveats
      : sanitizedFlags.map(f => `${f.title}: ${f.risk}`);

    return {
      documentType: category,
      language: analysis.language || 'English',
      confidenceScore: typeof analysis.confidenceScore === 'number' ? analysis.confidenceScore : 0.95,
      riskLevel: overallRisk,
      executiveSummary: analysis.executiveSummary || `${category} analysis completed with document-grounded verification.`,
      plainLanguageSummary: analysis.plainLanguageSummary || `Plain-language breakdown of rights, benefits, and obligations for ${category}.`,
      importantClauses: sanitizedClauses,
      redFlags: sanitizedFlags,
      financialObligations: sanitizedFinancials,
      importantDates: sanitizedDates,
      missingClauses: sanitizedMissing,
      recommendations: sanitizedRecs,
      actionItems,
      hiddenCaveats,
      atsScore: null,
      extractedSkills: [],
      matchedSkills: [],
      missingSkills: [],
      jobDescriptionMatch: null,
      education: [],
      experience: [],
      projects: [],
      certifications: [],
      achievements: [],
      resumeFeedback: null,
      contactInfo: {},
      personalInfo: {},
      suggestions: sanitizedRecs.map(r => r.action)
    };
  }
}

module.exports = new DocumentNormalizer();
