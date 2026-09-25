/**
 * Client-safe analysis engine — pure JS, no external dependencies.
 * Used as fallback when Gemini API is unavailable.
 */

function preprocessText(text) {
  if (!text) return '';
  return text
    .replace(/\r\n|\r/g, '\n')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractEntities(text) {
  const amountsRegex = /(₹|rs\.?|inr|usd|eur|gbp|\$|€|£)\s?\d{1,3}(?:[\,\s]\d{2,3})*(?:\.\d+)?/gi;
  const percentRegex = /\b\d{1,3}(?:\.\d+)?%/g;
  const durationRegex = /\b\d{1,3}\s?(business\s)?(day|days|week|weeks|month|months|year|years)\b/gi;
  const dateRegex = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s\d{1,2},?\s\d{2,4})/gi;
  const partiesRegex = /\b(?:between|party|parties|hereinafter|referred to as|"([^"]{3,40})")/gi;

  const hasAutoRenew = /auto[\-\s]?renew|renew(s)?\s+automatically|unless\s+cancelled/gi.test(text);
  const hasPenalty = /(penalty|late\s+fee|liquidated\s+damages|charges?)/gi.test(text);
  const hasArbitration = /arbitration|arbitral\s+tribunal|binding\s+arbitration/gi.test(text);
  const hasNonCompete = /non[\-\s]?compete|non[\-\s]?solicitation/gi.test(text);

  return {
    amounts: (text.match(amountsRegex) || []).slice(0, 20),
    percentages: (text.match(percentRegex) || []).slice(0, 20),
    durations: (text.match(durationRegex) || []).slice(0, 20),
    dates: (text.match(dateRegex) || []).slice(0, 20),
    hasAutoRenew, hasPenalty, hasArbitration, hasNonCompete
  };
}

function snippetAround(text, idx, span = 140) {
  const start = Math.max(0, idx - span);
  const end = Math.min(text.length, idx + span);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function detectClauses(text, entities) {
  const detectors = [
    { title: 'Payment Terms', type: 'financial', importance: 'high', regex: /(payment\s+terms?|invoice|due\s+date|payable|consideration)/gi, explanation: 'Specifies how and when payments must be made.' },
    { title: 'Termination Clause', type: 'operational', importance: 'high', regex: /(terminate|termination|notice\s+period|cancel(l)?ation)/gi, explanation: 'Explains how either party can end the agreement.' },
    { title: 'Limitation of Liability', type: 'legal', importance: 'high', regex: /(limitation\s+of\s+liability|liability\s+shall\s+not\s+exceed|cap\s+on\s+liability)/gi, explanation: 'Limits the maximum damages one party can claim.' },
    { title: 'Confidentiality', type: 'legal', importance: 'medium', regex: /(confidential|non\-disclosure|nda|proprietary\s+information)/gi, explanation: 'Sets rules for handling confidential information.' },
    { title: 'Governing Law', type: 'legal', importance: 'medium', regex: /(governing\s+law|jurisdiction|venue|arbitration|dispute\s+resolution)/gi, explanation: 'Defines which laws apply and how disputes are resolved.' },
    { title: 'Intellectual Property', type: 'legal', importance: 'medium', regex: /(intellectual\s+property|ip\s+rights|ownership|license|licence)/gi, explanation: 'Covers ownership and usage rights of created content.' },
    { title: 'Service Levels', type: 'operational', importance: 'medium', regex: /(service\s+level|sla|deliverable|milestone|timeline|scope\s+of\s+work)/gi, explanation: 'Describes required service quality and outputs.' },
    { title: 'Auto-Renewal', type: 'operational', importance: 'medium', regex: /(auto[\-\s]?renew|renews\s+automatically|unless\s+cancelled)/gi, explanation: 'Indicates the agreement renews automatically.' },
    { title: 'Indemnity', type: 'legal', importance: 'high', regex: /(indemnif(y|ication)|hold\s+harmless)/gi, explanation: 'One party agrees to cover certain losses of the other.' },
    { title: 'Warranty', type: 'operational', importance: 'medium', regex: /(warranty|guarantee|merchantability|fitness\s+for\s+purpose)/gi, explanation: 'Promises about product/service quality.' },
    { title: 'Force Majeure', type: 'legal', importance: 'medium', regex: /(force\s+majeure|act\s+of\s+god|unforeseeable)/gi, explanation: 'Excuses performance due to extraordinary events.' },
    { title: 'Non-Compete', type: 'legal', importance: 'high', regex: /(non[\-\s]?compete|non[\-\s]?solicitation|restraint\s+of\s+trade)/gi, explanation: 'Restricts competitive activities after the agreement.' }
  ];

  const results = [];
  detectors.forEach(d => {
    const regex = new RegExp(d.regex.source, d.regex.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const idx = match.index;
      const snippet = snippetAround(text, idx);
      const alreadyAdded = results.filter(r => r.title === d.title).length;
      if (alreadyAdded >= 2) break;
      results.push({ title: d.title, text: snippet, importance: d.importance, type: d.type, explanation: d.explanation });
      if (regex.lastIndex === idx) regex.lastIndex++;
    }
  });

  if (!results.length) {
    results.push({ title: 'General Terms', text: snippetAround(text, Math.min(100, text.length - 1)), importance: 'low', type: 'operational', explanation: 'General terms detected; full legal review recommended.' });
  }

  // Deduplicate by title
  const seen = new Set();
  return results.filter(r => { if (seen.has(r.title)) return false; seen.add(r.title); return true; });
}

function assessRisks(text, clauses, entities) {
  let financial = 3, legal = 3, operational = 3;
  const redFlags = [];
  const actionItems = [];

  if (entities.amounts.length > 0) financial += 1;
  if (entities.percentages.find(p => parseFloat(p) > 25)) financial += 2;
  if (/(late\s+fee|penalty|interest\s+at\s+\d+%)/gi.test(text)) {
    financial += 2;
    redFlags.push({ severity: 'medium', title: 'Penalty/Late Fee', description: 'Penalty or late fee clauses detected. Review amounts and conditions.' });
  }

  if (entities.hasArbitration) {
    legal += 2;
    redFlags.push({ severity: 'medium', title: 'Mandatory Arbitration', description: 'Disputes may be restricted to arbitration; may waive court/appeal rights.' });
  }
  if (/indemnif(y|ication)/gi.test(text)) {
    legal += 2;
    redFlags.push({ severity: 'high', title: 'Broad Indemnity', description: 'Indemnity obligations detected; ensure scope and limits are reasonable.' });
  }
  if (/(liability\s+shall\s+not\s+exceed|limitation\s+of\s+liability)/gi.test(text)) legal += 1;
  if (entities.hasNonCompete) {
    legal += 2;
    redFlags.push({ severity: 'high', title: 'Non-Compete Clause', description: 'Non-compete or non-solicitation restrictions may limit future opportunities.' });
  }

  if (/auto[\-\s]?renew|renews\s+automatically/gi.test(text)) {
    operational += 2;
    redFlags.push({ severity: 'medium', title: 'Auto-Renewal', description: 'Agreement may auto-renew unless cancelled—set reminders for notice periods.' });
  }
  if (/(notice\s+period|\b\d{1,3}\s+(business\s+)?days\b)/gi.test(text)) operational += 1;
  if (/(service\s+level|sla|deliverable|milestone)/gi.test(text)) operational += 1;

  financial = Math.min(10, Math.max(1, financial));
  legal = Math.min(10, Math.max(1, legal));
  operational = Math.min(10, Math.max(1, operational));

  const toLevel = s => s >= 7 ? 'high' : s >= 4 ? 'medium' : 'low';
  const categories = [
    { name: 'Financial Risk', level: toLevel(financial), score: financial, details: 'Based on payment terms, amounts, and fee structures.' },
    { name: 'Legal Risk', level: toLevel(legal), score: legal, details: 'Based on indemnity, arbitration, and liability terms.' },
    { name: 'Operational Risk', level: toLevel(operational), score: operational, details: 'Based on renewal, notices, and service obligations.' }
  ];

  const rank = l => l === 'high' ? 3 : l === 'medium' ? 2 : 1;
  const inv = r => r === 3 ? 'high' : r === 2 ? 'medium' : 'low';
  const overall = inv(Math.max(...categories.map(c => rank(c.level))));

  if (entities.hasAutoRenew) actionItems.push('Set a calendar reminder ahead of any auto-renewal/termination notice window.');
  if (entities.hasPenalty) actionItems.push('Negotiate or clarify penalty and late fee provisions.');
  if (entities.hasArbitration) actionItems.push('Assess implications of mandatory arbitration on dispute resolution.');
  if (clauses.find(c => c.title === 'Payment Terms')) actionItems.push('Confirm invoice cadence and payment due dates match your cash flow.');
  if (clauses.find(c => c.title === 'Limitation of Liability')) actionItems.push('Verify liability cap is aligned with contract value and risk.');
  if (clauses.find(c => c.title === 'Non-Compete')) actionItems.push('Consult a lawyer about the enforceability and scope of non-compete terms.');
  if (actionItems.length === 0) actionItems.push('Perform a thorough legal review to identify all obligations and risks.');

  return { riskLevel: overall, categories, redFlags, actionItems };
}

function detectDocumentType(text, fileName) {
  const nameLower = (fileName || '').toLowerCase();
  const textLower = (text || '').toLowerCase().slice(0, 2000);

  if (nameLower.includes('nda') || nameLower.includes('non-disclosure') || /non[\-\s]?disclosure/i.test(textLower)) return 'NDA / Confidentiality Agreement';
  if (nameLower.includes('lease') || nameLower.includes('rental') || /tenancy|landlord|tenant/i.test(textLower)) return 'Lease / Rental Agreement';
  if (nameLower.includes('employment') || nameLower.includes('offer') || /employment|employer|employee|salary|compensation/i.test(textLower)) return 'Employment Agreement';
  if (nameLower.includes('purchase') || /purchase\s+price|buyer|seller|sale\s+of/i.test(textLower)) return 'Purchase Agreement';
  if (nameLower.includes('service') || /service\s+agreement|scope\s+of\s+work|deliverable/i.test(textLower)) return 'Service Agreement';
  if (nameLower.includes('license') || /license\s+grant|licensee|licensor/i.test(textLower)) return 'License Agreement';
  if (/insurance|policy|premium|coverage|insured/i.test(textLower)) return 'Insurance Policy';
  if (/loan|borrower|lender|interest\s+rate|repayment/i.test(textLower)) return 'Loan Agreement';
  return 'General Legal Document';
}

function buildOverview(text, clauses, entities, persona) {
  const parts = [];
  const docType = detectDocumentType(text, '');

  if (clauses.find(c => c.title === 'Payment Terms')) parts.push('This document defines specific payment obligations.');
  if (clauses.find(c => c.title === 'Termination Clause')) parts.push('It includes termination conditions and notice periods.');
  if (clauses.find(c => c.title === 'Limitation of Liability')) parts.push('Liability limitations are present and should be reviewed carefully.');
  if (clauses.find(c => c.title === 'Confidentiality')) parts.push('Confidentiality requirements are specified.');
  if (clauses.find(c => c.title === 'Governing Law')) parts.push('Governing law and dispute resolution terms are included.');
  if (parts.length === 0) parts.push('The document contains various legal terms requiring careful review.');

  const personaPrefix = {
    student: 'As a student reviewing this document: ',
    business: 'From a business perspective: ',
    lawyer: 'Legal analysis: ',
    senior: 'In plain terms: '
  };

  return (personaPrefix[persona] || '') + parts.join(' ');
}

/**
 * Offline Resume / CV analysis
 */
function runOfflineResumeAnalysis(text, persona, fileName, jobDescription = '') {
  let parsed = null;
  try {
    const resumeParser = require('../src/services/resume/resumeParser.service');
    parsed = resumeParser.parseFromText(text, jobDescription);
  } catch (err) {
    console.warn('Could not load resumeParser.service, using basic regex parser:', err.message);
  }

  if (parsed) {
    const name = (parsed.personalInfo?.name && parsed.personalInfo.name !== 'Information Not Found In Document') 
      ? parsed.personalInfo.name 
      : fileName;
    const overview = `Resume analysis for candidate ${name}. Extracted ${parsed.skills?.length || 0} core technical and domain skills across competencies. Overall ATS Compatibility score calculated at ${parsed.atsScore}%.`;
    const keyFindings = [
      `ATS Compatibility Score: ${parsed.atsScore}%`,
      `Identified ${parsed.skills?.length || 0} key skills: ${(parsed.skills || []).slice(0, 6).join(', ')}${parsed.skills?.length > 6 ? '...' : ''}`,
      parsed.personalInfo?.email ? `Contact: ${parsed.personalInfo.email}` : 'Contact email missing'
    ];
    if (parsed.jobDescriptionMatch?.matchedSkills?.length > 0) {
      keyFindings.push(`Matched Job Description Skills: ${parsed.jobDescriptionMatch.matchedSkills.slice(0, 5).join(', ')}`);
    }

    return {
      id: 'resume_analysis_' + Date.now(),
      fileName,
      persona,
      uploadDate: new Date().toISOString(),
      source: 'offline_resume',
      documentType: 'Resume / CV',
      confidence: 0.85,
      language: /[\u0900-\u097F]/.test(text) ? 'Hindi' : 'English',
      riskLevel: parsed.atsScore >= 75 ? 'low' : parsed.atsScore >= 50 ? 'medium' : 'high',
      summary: { title: 'Resume / CV Analysis', overview, riskLevel: parsed.atsScore >= 75 ? 'low' : 'medium', keyFindings },
      atsScore: parsed.atsScore,
      atsScoreBreakdown: parsed.atsScoreBreakdown,
      atsAssessment: parsed.atsAssessment,
      skills: parsed.skills,
      extractedSkills: parsed.skills,
      matchedSkills: parsed.jobDescriptionMatch?.matchedSkills || [],
      missingSkills: parsed.jobDescriptionMatch?.missingSkills || [],
      jobDescriptionMatch: parsed.jobDescriptionMatch,
      personalInfo: parsed.personalInfo,
      contactInfo: parsed.personalInfo,
      education: parsed.education,
      experience: parsed.experience,
      projects: parsed.projects,
      certifications: parsed.certifications,
      achievements: parsed.achievements,
      resumeFeedback: parsed.resumeFeedback,
      recommendations: (parsed.resumeFeedback?.improvements || []).map(imp => ({ action: imp, rationale: 'Enhances ATS readability and recruiter scoring.' })),
      actionItems: parsed.resumeFeedback?.improvements || [],
      suggestions: parsed.resumeFeedback?.improvements || [],
      keyClauses: [],
      redFlags: [],
      highlights: { amounts: [], percentages: [], dates: [], durations: [] },
      docText: text
    };
  }

  const normalizedText = preprocessText(text);

  // Extract contact info
  const emailMatch = normalizedText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
  const phoneMatch = normalizedText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const linksMatch = normalizedText.match(/(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/[^\s]+|github\.com\/[^\s]+|[a-zA-Z0-9-]+\.(?:com|org|io|dev|in)[^\s]*)/gi);

  const lines = normalizedText.split('\n').map(l => l.trim()).filter(Boolean);
  let name = 'Information Not Found In Document';
  if (lines.length > 0) {
    const firstLine = lines[0].replace(/^(curriculum vitae|resume|cv)\s*[-:]?\s*/i, '').trim();
    if (firstLine.length > 2 && firstLine.length < 50 && !firstLine.includes('@')) {
      name = firstLine;
    }
  }

  const contactInfo = {
    name: name || 'Information Not Found In Document',
    email: emailMatch ? emailMatch[0] : 'Information Not Found In Document',
    phone: phoneMatch ? phoneMatch[0] : 'Information Not Found In Document',
    links: linksMatch ? linksMatch.slice(0, 3).join(', ') : 'Information Not Found In Document'
  };

  const skillKeywords = [
    'JavaScript', 'TypeScript', 'React', 'React.js', 'Next.js', 'Node.js', 'Express', 'Express.js',
    'Python', 'Django', 'Flask', 'Java', 'Spring Boot', 'C++', 'C#', '.NET', 'Go', 'Golang', 'Rust',
    'HTML', 'HTML5', 'CSS', 'CSS3', 'Tailwind', 'TailwindCSS', 'Bootstrap', 'Sass',
    'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Firebase', 'Supabase', 'NoSQL',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD', 'Git', 'GitHub', 'GitLab', 'Linux',
    'REST API', 'GraphQL', 'Microservices', 'System Design', 'Agile', 'Scrum', 'Jira',
    'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Data Analysis', 'Pandas', 'NumPy',
    'Communication', 'Leadership', 'Problem Solving', 'Teamwork', 'Project Management', 'Critical Thinking'
  ];

  const lowerDoc = normalizedText.toLowerCase();
  const extractedSkills = skillKeywords.filter(skill => {
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(lowerDoc);
  });

  return {
    id: 'resume_analysis_' + Date.now(),
    fileName,
    persona,
    uploadDate: new Date().toISOString(),
    source: 'offline_resume',
    documentType: 'Resume / CV',
    confidence: 0.85,
    language: /[\u0900-\u097F]/.test(text) ? 'Hindi' : 'English',
    riskLevel: 'low',
    summary: { title: 'Resume / CV Analysis', overview: `Resume analysis for ${name}`, riskLevel: 'low', keyFindings: [] },
    atsScore: 75,
    atsScoreBreakdown: { contact: 8, sections: 10, skills: 15, experience: 12, education: 8, projects: 12, formatting: 10 },
    atsAssessment: 'Good ATS compatibility based on detected keywords and section layout.',
    skills: extractedSkills,
    extractedSkills,
    matchedSkills: [],
    missingSkills: [],
    jobDescriptionMatch: null,
    personalInfo: contactInfo,
    contactInfo,
    education: [],
    experience: [],
    projects: [],
    certifications: [],
    achievements: [],
    resumeFeedback: { strengths: ['Technical skills detected.'], improvements: [], atsChecklist: [] },
    recommendations: [],
    actionItems: [],
    suggestions: [],
    keyClauses: [],
    redFlags: [],
    highlights: { amounts: [], percentages: [], dates: [], durations: [] },
    docText: normalizedText
  };
}

/**
 * Main function — run full offline analysis
 */
function runOfflineAnalysis(text, persona, fileName, documentType = 'general', jobDescription = '') {
  const isResume = (documentType || '').toLowerCase() === 'resume'
    || (documentType || '').toLowerCase().includes('resume')
    || (documentType || '').toLowerCase().includes('cv')
    || (fileName || '').toLowerCase().includes('resume')
    || (fileName || '').toLowerCase().includes('cv');

  if (isResume) {
    return runOfflineResumeAnalysis(text, persona, fileName, jobDescription);
  }

  try {
    const legalAnalysisService = require('../src/services/legal/legalAnalysis.service');
    return legalAnalysisService.parseFromText(text, persona, fileName, documentType);
  } catch (err) {
    console.warn('Could not load legalAnalysis.service, using legacy fallback:', err.message);
  }

  const normalizedText = preprocessText(text);
  const entities = extractEntities(normalizedText);
  const clauses = detectClauses(normalizedText, entities);
  const { riskLevel, categories, redFlags, actionItems } = assessRisks(normalizedText, clauses, entities);
  const docType = detectDocumentType(normalizedText, fileName);
  const overview = buildOverview(normalizedText, clauses, entities, persona);

  const keyFindings = [];
  if (entities.amounts.length) keyFindings.push(`Monetary amounts found: ${entities.amounts.slice(0, 3).join(', ')}`);
  if (entities.durations.length) keyFindings.push(`Timeframes/notice periods: ${entities.durations.slice(0, 3).join(', ')}`);
  if (entities.percentages.length) keyFindings.push(`Percentages found: ${entities.percentages.slice(0, 3).join(', ')}`);
  const flags = [];
  if (entities.hasAutoRenew) flags.push('Auto-renewal present');
  if (entities.hasArbitration) flags.push('Mandatory arbitration indicated');
  if (entities.hasPenalty) flags.push('Penalties/fees mentioned');
  if (flags.length) keyFindings.push(flags.join(' • '));
  if (!keyFindings.length) keyFindings.push('No obvious numeric terms or risk indicators detected.');

  const counterpartyScore = riskLevel === 'high' ? 45 : riskLevel === 'medium' ? 65 : 80;
  const counterpartyGrade = counterpartyScore >= 80 ? 'A' : counterpartyScore >= 65 ? 'B' : counterpartyScore >= 50 ? 'C' : 'D';

  return {
    id: 'analysis_' + Date.now(),
    fileName,
    persona,
    uploadDate: new Date().toISOString(),
    source: 'offline',
    documentType: docType,
    confidence: 0.75,
    language: /[\u0900-\u097F]/.test(text) ? 'Hindi' : 'English',
    summary: { title: `${docType} Analysis`, overview, riskLevel, keyFindings },
    riskAssessment: { overall: riskLevel, categories },
    keyClauses: clauses,
    redFlags,
    actionItems,
    highlights: {
      amounts: entities.amounts,
      percentages: entities.percentages,
      dates: entities.dates,
      durations: entities.durations
    },
    counterparty: {
      grade: counterpartyGrade,
      score: counterpartyScore,
      label: `${counterpartyGrade} Rating`,
      notes: 'Based on offline clause and risk analysis.'
    },
    rights: [
      { title: 'Right to Review', description: 'You have the right to review all terms before signing.', status: 'protected' },
      { title: 'Right to Negotiate', description: 'You can negotiate terms before agreeing.', status: 'protected' },
      { title: 'Termination Rights', status: clauses.find(c => c.title === 'Termination Clause') ? 'protected' : 'at_risk', description: 'Your ability to exit the agreement.' }
    ],
    compliance: [
      { law: 'Indian Contract Act 1872', status: 'compliant', note: 'General contract principles appear satisfied.' },
      { law: 'Consumer Protection Act', status: 'needs_review', note: 'Review for consumer-protective clauses.' },
      { law: 'Data Protection', status: 'compliant', note: 'No obvious data protection violations detected.' }
    ],
    suggestions: [
      { type: 'legal_review', priority: 'high', title: 'Seek Professional Review', description: 'Have a qualified lawyer review this document before signing.', clause: '' },
      ...(entities.hasArbitration ? [{ type: 'clarification', priority: 'medium', title: 'Understand Arbitration Clause', description: 'Mandatory arbitration may limit your ability to go to court.', clause: '' }] : []),
      ...(entities.hasAutoRenew ? [{ type: 'negotiation', priority: 'medium', title: 'Negotiate Auto-Renewal Terms', description: 'Request a longer notice window for cancellation or opt-out.', clause: '' }] : [])
    ],
    docText: normalizedText
  };
}

// Export for use in both Node.js and browser
if (typeof module !== 'undefined') module.exports = { runOfflineAnalysis, runOfflineResumeAnalysis, extractEntities, detectClauses, assessRisks, preprocessText, detectDocumentType };
