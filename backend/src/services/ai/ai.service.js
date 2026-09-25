const { GoogleGenerativeAI } = require('@google/generative-ai');
const { runOfflineAnalysis } = require('../../../services/analysisEngine');
const resumeParser = require('../resume/resumeParser.service');
const legalAnalysisService = require('../legal/legalAnalysis.service');

class AIService {
  constructor() {
    this.primaryProvider = process.env.PRIMARY_AI_PROVIDER || 'gemini'; // 'gemini' | 'openai'
    this.geminiModelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    this.openaiModelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  getGeminiModel(systemInstruction = '', modelName = null) {
    if (!process.env.GEMINI_API_KEY) return null;
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      return genAI.getGenerativeModel({
        model: modelName || this.geminiModelName,
        ...(systemInstruction ? { systemInstruction } : {})
      });
    } catch (err) {
      console.error('Error initializing Gemini model:', err.message);
      return null;
    }
  }

  /**
   * Helper to call OpenAI API using native fetch
   */
  async callOpenAI(systemPrompt, userPrompt) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: this.openaiModelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.statusText} ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * Main analysis execution. Tries primary provider, falls back to secondary, then to offline.
   */
  async analyzeDocument(retrievedChunksText, persona = 'default', fileName = 'document', jobDescription = '', documentType = 'general') {
    const personaInstructions = {
      student: 'Explain concepts simply as if to a university student. Define terms clearly, provide educational context, and make it easy to understand.',
      business: 'Focus on business implications, financial impacts, and operational considerations for an entrepreneur or business owner.',
      lawyer: 'Provide technical legal analysis with references to relevant legal principles, potential precedents, and professional considerations.',
      senior: 'Use very clear, patient language. Focus on protecting rights, identifying potential pitfalls, and ensuring the person is not taken advantage of.',
      default: 'Provide a clear, balanced analysis suitable for a general audience.'
    };

    const personaGuide = personaInstructions[persona] || personaInstructions.default;

    const isResume = (documentType || '').toLowerCase() === 'resume'
      || (documentType || '').toLowerCase().includes('resume')
      || (documentType || '').toLowerCase().includes('cv')
      || (fileName || '').toLowerCase().includes('resume')
      || (fileName || '').toLowerCase().includes('cv');

    let systemPrompt = '';
    let userPrompt = '';

    if (isResume) {
      systemPrompt = `You are an expert HR recruiter, career coach, and ATS (Applicant Tracking System) screening specialist.
Analyze the provided candidate resume segments and return a comprehensive, highly detailed resume evaluation in JSON format.

Strict Rules for Analysis:
1. Analyze ONLY the provided resume content. Do not invent experience, skills, degrees, or certifications not present in the document.
2. If information is not found in the document, use empty string "" or empty array [].
3. Calculate an accurate, objective ATS compatibility score (0-100) based on relevance, completeness, keywords, structure, and readability.
   - If a target Job Description is provided, factor in keyword match, required skills, and qualification overlap against the Job Description.
   - If no Job Description is provided, evaluate against general industry standards and set "jobDescriptionMatch" to null.
4. Extract canonical technical and domain skills into "skills".
5. Extract projects with their technologies, descriptions, and URLs into "projects".
6. Extract candidate contact info into "personalInfo": { "name": string, "email": string, "phone": string, "location": string, "linkedin": string, "github": string, "portfolio": string, "otherLinks": string[] }.
   - Never classify software libraries or technologies (such as Socket.io, Node.js, Express.js, React.js, MySQL) as personal websites.
   - Never classify email domains (such as gmail.com) as personal websites.
7. Extract education history into "education": array of objects { "institution": string, "degree": string, "field": string, "year": string, "score": string }.
8. Extract work experience into "experience": array of objects { "role": string, "company": string, "location": string, "duration": string, "description": string[] }.
9. Extract certifications into "certifications": array of objects { "name": string, "issuer": string, "date": string, "credentialUrl": string }.
10. Extract achievements into "achievements": array of strings.
11. Provide granular, constructive "resumeFeedback" with { "strengths": string[], "improvements": string[], "atsChecklist": [ { "item": string, "passed": boolean } ] }.
12. Write a verbose, detailed "executiveSummary" (200-350 words) highlighting candidate core competencies, strengths, and background.
13. Write a verbose, detailed "plainLanguageSummary" (250-400 words) giving an honest breakdown of the candidate's qualifications, market positioning, and growth areas.
14. THIS IS A RESUME / CV. NEVER GENERATE ANY CONTRACTUAL CLAUSES, PAYMENT PENALTIES, TERMINATION, GOVERNING LAW, OR FORCE MAJEURE CLAUSES. Leave contract fields empty: "importantClauses": [], "redFlags": [], "financialObligations": [], "importantDates": [], "missingClauses": [], "hiddenCaveats": [].
15. Set "documentType": "Resume / CV". Set "riskLevel": "low" (or "medium" if major structural gaps exist).`;

      userPrompt = `RESUME DOCUMENT (filename: ${fileName}):
"""
${retrievedChunksText}
"""

TARGET JOB DESCRIPTION (Compare against this if provided):
"""
${jobDescription || 'No specific job description provided. Evaluate against modern industry standards for this candidate profile.'}
"""

PERSONA TARGET: ${personaGuide}

Return ONLY valid JSON in this exact structure (do not wrap in markdown \`\`\`json block, return pure JSON):
{
  "documentType": "Resume / CV",
  "language": "English|Hindi",
  "confidenceScore": 0.95,
  "riskLevel": "low|medium|high",
  "executiveSummary": "Detailed summary of candidate profile, strengths, and background (200-350 words)",
  "plainLanguageSummary": "Detailed breakdown of qualifications, market positioning, and improvement areas (250-400 words)",
  "atsScore": 85,
  "atsScoreBreakdown": {
    "contact": 10,
    "sections": 15,
    "skills": 20,
    "experience": 17,
    "education": 10,
    "projects": 15,
    "formatting": 8
  },
  "atsAssessment": "Objective assessment statement regarding ATS alignment",
  "personalInfo": {
    "name": "Full Name",
    "email": "Email Address",
    "phone": "Phone Number",
    "location": "City, State/Country",
    "linkedin": "LinkedIn profile URL",
    "github": "GitHub profile URL",
    "portfolio": "Portfolio URL",
    "otherLinks": []
  },
  "summary": "Candidate professional summary",
  "skills": ["Skill1", "Skill2", "Skill3"],
  "projects": [
    { "name": "Project Name", "technologies": ["Tech1", "Tech2"], "description": ["Key detail or achievement 1"], "url": "URL or empty" }
  ],
  "experience": [
    { "role": "Job Title", "company": "Company Name", "location": "City/Remote", "duration": "Dates/Duration", "description": ["Responsibility or accomplishment 1"] }
  ],
  "education": [
    { "institution": "University/College", "degree": "Degree Title", "field": "Field of Study", "year": "Graduation Year", "score": "CGPA/GPA/Score" }
  ],
  "certifications": [
    { "name": "Certification Name", "issuer": "Issuer Organization", "date": "Date", "credentialUrl": "" }
  ],
  "achievements": ["Achievement or award 1"],
  "jobDescriptionMatch": ${jobDescription && jobDescription.trim().length > 5 ? `{
    "matchPercentage": 85,
    "matchedSkills": ["Skill1"],
    "missingSkills": ["Skill2"],
    "summary": "Match overview",
    "suggestions": ["Suggestion 1"]
  }` : `null`},
  "resumeFeedback": {
    "strengths": ["Strength 1", "Strength 2"],
    "improvements": ["Improvement suggestion 1", "Improvement suggestion 2"],
    "atsChecklist": [
      { "item": "Contact information listed", "passed": true },
      { "item": "Core sections present", "passed": true },
      { "item": "Technical skills populated", "passed": true }
    ]
  },
  "recommendations": [
    { "action": "Action to take", "rationale": "Why this action improves candidate prospects" }
  ],
  "suggestions": ["Improvement suggestion 1"],
  "actionItems": ["Task item 1"],
  "importantClauses": [],
  "redFlags": [],
  "financialObligations": [],
  "importantDates": [],
  "missingClauses": [],
  "hiddenCaveats": []
}`;
    } else {
      systemPrompt = `You are an expert legal document and contract analysis engine.
Analyze the provided document text and return a comprehensive, document-grounded evaluation in JSON format.

Strict Rules for Analysis:
1. Category Detection: Automatically detect the specific category from the document text (e.g. "Insurance Policy", "Employment Agreement", "Rental / Lease Agreement", "Non-Disclosure Agreement (NDA)", "Service Agreement", "Loan / Credit Agreement", "Terms & Conditions", "General Contract / Agreement"). Never label an insurance policy as generic contract.
2. Grounded Truth Only: Analyze ONLY text actually present in the document. Quote supporting text verbatim in "excerpt" or "source_text".
3. Semantic Clause Classification:
   - Determine the true meaning of each clause from context, not isolated keywords.
   - If text discusses assignment or transfer of policy/rights to another person or lender, classify it as "Assignment & Transfer of Rights". NEVER classify it as "Payment Terms".
   - If text contains an Insurance Ombudsman, regulatory authority, or complaint escalation address, classify it as "Grievance Redressal & Ombudsman" or omit it. NEVER classify it as "Confidentiality".
   - ONLY classify as "Confidentiality & Non-Disclosure" if the document contains genuine non-disclosure obligations, trade secret covenants, or privacy duties.
4. Financial Obligations:
   - Extract real financial commitments from context: premiums, maturity benefits, death benefits, surrender values, late fees, penalties, security deposits, interest rates.
   - Include type, amount/value, unit, description, and source terms.
   - If no financial metrics exist, return empty array [].
5. Date & Timeframe Validation:
   - DO NOT treat telephone numbers, slash-separated extensions (e.g. "25/26/27", "28/28/29"), table coordinates, page numbers, or policy codes (e.g. UIN numbers) as dates!
   - Only extract legitimate calendar dates or operative timeframes/periods confirmed by context (e.g. "30 days Free Look Period", "15 days Grace Period", "5 years Revival Period", "12 months Suicide Exclusion", "30 days notice").
6. Real Risks & Red Flags:
   - Detect material contractual risks: exclusions (e.g. suicide exclusion), policy lapse upon missed premium, surrender value forfeiture, loan foreclosure, non-compete, broad indemnities.
   - For every risk: include title, severity (high/medium/low), risk explanation, consequences, and verbatim excerpt.
   - If no material risk exists: state that no material risks were identified in the analyzed clauses; do NOT claim the agreement is "fair".
7. Document-Grounded Recommendations:
   - NEVER generate generic contract boilerplate like "Negotiate penalty and late fee" or "Confirm invoice cadence and payment due dates match your cash flow" unless supported by actual text.
   - Recommendations must be strictly derived from detected clauses (e.g. Free-look window -> review terms within 15/30 days to return for refund; Grace period -> pay within grace period to prevent lapse; Surrender terms -> check surrender value schedule before exit).
8. Category-Aware Missing Clauses:
   - Check standard expected safeguards for the detected category (e.g. for an Insurance Policy check for Free-Look Period, Grace Period, Ombudsman; do NOT complain about Force Majeure or Invoicing).
   - Use truthful wording: "Not identified in the analyzed document."
9. Summaries: Provide detailed, verbose executiveSummary (250-350 words) and plainLanguageSummary (300-450 words) grounded in the document facts and tailored to the persona.
10. Contract vs Resume: THIS IS A LEGAL / FINANCIAL / CONTRACT DOCUMENT. Leave resume fields empty/null.`;

      userPrompt = `DOCUMENT CONTENT (filename: ${fileName}):
"""
${retrievedChunksText}
"""

PERSONA TARGET: ${personaGuide}

Return ONLY valid JSON in this exact structure (do not wrap in markdown \`\`\`json block, return pure JSON):
{
  "documentType": "Detected Specific Category (e.g. Insurance Policy, Employment Agreement, Rental / Lease Agreement, Non-Disclosure Agreement (NDA), Service Agreement, Loan / Credit Agreement)",
  "language": "English|Hindi",
  "confidenceScore": 0.95,
  "riskLevel": "low|medium|high",
  "executiveSummary": "Highly detailed, verbose summary of the document tailored to the persona (250-350 words)",
  "plainLanguageSummary": "Highly detailed, verbose plain language explanation explaining terms tailored to the persona (300-450 words)",
  "importantClauses": [
    { "title": "Clause Title", "category": "Category", "excerpt": "quoted text", "importance": "high|medium|low", "explanation": "explanation" }
  ],
  "redFlags": [
    { "title": "Flag Name", "excerpt": "quoted text", "severity": "high|medium|low", "risk": "risk details", "consequences": "consequences if signed" }
  ],
  "financialObligations": [
    { "type": "Obligation Type", "description": "Payment / Benefit / Penalty detail", "amount": "Amount or formula", "unit": "INR / % / etc.", "terms": "source terms text" }
  ],
  "importantDates": [
    { "date": "Date or Period (e.g. 30 days Free Look)", "significance": "Significance of deadline", "impact": "Operational impact" }
  ],
  "missingClauses": [
    { "clause": "Clause Name", "explanation": "Not identified in the analyzed document. Explanation of standard safeguard" }
  ],
  "recommendations": [
    { "action": "Actionable item", "rationale": "Why this action should be taken", "source_clause": "Clause Name", "priority": "high|medium|low" }
  ],
  "actionItems": ["Task item 1", "Task item 2"],
  "hiddenCaveats": ["Tricky caveat 1", "Tricky caveat 2"],
  "atsScore": null,
  "extractedSkills": [],
  "matchedSkills": [],
  "missingSkills": [],
  "education": [],
  "experience": [],
  "jobDescriptionMatch": null,
  "resumeFeedback": null,
  "contactInfo": {}
}`;
    }

    // Try Gemini Primary (with candidate model retry on 503 temporary demand spikes)
    if (this.primaryProvider === 'gemini' && process.env.GEMINI_API_KEY) {
      const candidateModels = [this.geminiModelName, 'gemini-3.5-flash-lite', 'gemini-flash-latest'];
      for (const mName of candidateModels) {
        try {
          console.log(`Sending request to Gemini (${mName})...`);
          const model = this.getGeminiModel(systemPrompt, mName);
          if (model) {
            const result = await model.generateContent(userPrompt);
            const responseText = result.response.text();
            const parsed = this.cleanAndParseJSON(responseText);
            return this.normalizeAnalysisResult(parsed, isResume, documentType, retrievedChunksText, jobDescription, persona, fileName);
          }
        } catch (err) {
          console.warn(`Gemini (${mName}) attempt failed:`, err.message);
          if (err.message && (err.message.includes('503') || err.message.includes('429'))) {
            await new Promise(r => setTimeout(r, 1200));
          }
        }
      }
    }

    // Try OpenAI Fallback
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log('Sending request to OpenAI...');
        const responseText = await this.callOpenAI(systemPrompt, userPrompt);
        const parsed = this.cleanAndParseJSON(responseText);
        return this.normalizeAnalysisResult(parsed, isResume, documentType, retrievedChunksText, jobDescription, persona, fileName);
      } catch (err) {
        console.warn('OpenAI fallback failed. Falling back to offline model...', err.message);
      }
    }

    // Double check: if provider was openai and it failed, try Gemini if key exists
    if (this.primaryProvider === 'openai' && process.env.GEMINI_API_KEY) {
      try {
        console.log('Attempting Gemini as alternate fallback...');
        const model = this.getGeminiModel();
        if (model) {
          const result = await model.generateContent([systemPrompt, userPrompt]);
          const parsed = this.cleanAndParseJSON(result.response.text());
          return this.normalizeAnalysisResult(parsed, isResume, documentType, retrievedChunksText, jobDescription, persona, fileName);
        }
      } catch (err) {
        console.warn('Gemini alternate fallback failed:', err.message);
      }
    }

    // Offline Local Engine Fallback
    console.log('Using Offline Local Fallback Engine...');
    if (isResume) {
      const validated = resumeParser.parseFromText(retrievedChunksText, jobDescription);
      return {
        ...validated,
        documentType: 'Resume / CV',
        language: 'English',
        confidenceScore: 0.85,
        riskLevel: validated.atsScore >= 75 ? 'low' : validated.atsScore >= 50 ? 'medium' : 'high',
        executiveSummary: `Resume analysis for candidate ${validated.personalInfo?.name || fileName}. Extracted ${validated.skills?.length || 0} core technical and domain skills across competencies. Overall ATS Compatibility score calculated at ${validated.atsScore}%.`,
        plainLanguageSummary: Array.isArray(validated.resumeFeedback?.improvements) && validated.resumeFeedback.improvements.length > 0 
          ? `Key areas for enhancement: ${validated.resumeFeedback.improvements.join(' ')}` 
          : 'Candidate qualifications and career profile evaluated.',
        contactInfo: validated.personalInfo,
        extractedSkills: validated.skills,
        matchedSkills: validated.jobDescriptionMatch?.matchedSkills || [],
        missingSkills: validated.jobDescriptionMatch?.missingSkills || [],
        recommendations: (validated.resumeFeedback?.improvements || []).map(imp => ({ action: imp, rationale: 'Actionable ATS and recruiter enhancement' })),
        actionItems: validated.resumeFeedback?.improvements || [],
        suggestions: validated.resumeFeedback?.improvements || [],
        importantClauses: [],
        redFlags: [],
        financialObligations: [],
        importantDates: [],
        missingClauses: [],
        hiddenCaveats: []
      };
    }

    return legalAnalysisService.parseFromText(retrievedChunksText, persona, fileName, documentType);
  }

  /**
   * Normalize and sanitize analysis output structure
   */
  normalizeAnalysisResult(parsed, isResume, documentType, rawText = '', jobDescription = '', persona = 'default', fileName = '') {
    if (isResume) {
      const validated = resumeParser.normalizeAndValidate(parsed, rawText, jobDescription);
      return {
        ...validated,
        documentType: 'Resume / CV',
        language: parsed.language || 'English',
        confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.95,
        riskLevel: parsed.riskLevel || 'low',
        executiveSummary: parsed.executiveSummary || validated.summary || 'Resume evaluation completed.',
        plainLanguageSummary: parsed.plainLanguageSummary || 'Candidate qualifications and career profile analysis.',
        contactInfo: validated.personalInfo,
        extractedSkills: validated.skills,
        matchedSkills: validated.jobDescriptionMatch?.matchedSkills || [],
        missingSkills: validated.jobDescriptionMatch?.missingSkills || [],
        recommendations: (validated.resumeFeedback?.improvements || []).map(imp => ({ action: imp, rationale: 'Actionable ATS and recruiter enhancement' })),
        actionItems: validated.resumeFeedback?.improvements || [],
        suggestions: validated.resumeFeedback?.improvements || [],
        importantClauses: [],
        redFlags: [],
        financialObligations: [],
        importantDates: [],
        missingClauses: [],
        hiddenCaveats: []
      };
    }

    return legalAnalysisService.normalizeAndValidate(parsed, rawText, persona, fileName, documentType);
  }

  /**
   * Conversational QA with document context
   */
  async chatAboutDocument(question, fullDocumentText, conversationHistory = []) {
    const historyText = conversationHistory
      .slice(-6)
      .map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
      .join('\n');

    const systemPrompt = `You are an expert document consultant and conversational AI assistant. Your goal is to help the user understand, analyze, and take action on their uploaded document.

Guidelines:
1. Primary Context: Use the provided document text to answer questions about the specific facts, names, terms, dates, and contents of the uploaded file.
2. External Expertise: Think out of the box! If the user asks questions that go beyond what is explicitly written in the document (such as explaining general legal concepts, drafting email responses, comparing terms to industry standards, recommending skills to learn, or suggesting improvements), use your broad knowledge base to provide detailed, helpful answers.
3. Clear Distinction: When providing advice or information not found in the text, clarify that you are drawing from general industry standards or legal practices.
4. Style: Be conversational, direct, formatting-rich (use bold text, lists, and headers), and highly supportive.`;

    const userPrompt = `DOCUMENT TEXT:
"""
${fullDocumentText || 'No document text found.'}
"""

${historyText ? `CONVERSATION HISTORY:\n${historyText}\n` : ''}
USER QUESTION: ${question}

Provide a clear, highly accurate, and helpful response.`;

    // Try Gemini Primary
    if (this.primaryProvider === 'gemini' && process.env.GEMINI_API_KEY) {
      try {
        const model = this.getGeminiModel(systemPrompt);
        if (model) {
          const result = await model.generateContent(userPrompt);
          return result.response.text();
        }
      } catch (err) {
        console.warn('Gemini Chat failed, attempting OpenAI...', err.message);
      }
    }

    // Try OpenAI Fallback
    if (process.env.OPENAI_API_KEY) {
      try {
        const responseText = await this.callOpenAI(systemPrompt, userPrompt);
        return responseText;
      } catch (err) {
        console.warn('OpenAI Chat failed, using offline Q&A...', err.message);
      }
    }

    // Fallback: rule-based
    return `[OFFLINE ANSWER] ${fullDocumentText ? fullDocumentText.slice(0, 300) + '...' : 'Information Not Found In Document'}`;
  }

  /**
   * Translate text into English/Hindi using Gemini
   */
  async translateAnalysis(analysisObject, targetLanguage = 'hi') {
    const targetLangName = targetLanguage === 'hi' ? 'Hindi' : 'English';
    const systemPrompt = `You are a professional legal translator. Translate the JSON analysis document into standard ${targetLangName}. Keep all JSON key names exactly the same, only translating the string values. Do not translate terms like names of parties if it makes them unrecognizable, but translate the legal explanations, summaries, and action steps.`;
    const userPrompt = `JSON to translate:\n${JSON.stringify(analysisObject, null, 2)}`;

    if (process.env.GEMINI_API_KEY) {
      try {
        const model = this.getGeminiModel(systemPrompt);
        if (model) {
          const result = await model.generateContent(userPrompt);
          return this.cleanAndParseJSON(result.response.text());
        }
      } catch (err) {
        console.warn('Gemini Translation failed, attempting OpenAI...', err.message);
      }
    }

    if (process.env.OPENAI_API_KEY) {
      try {
        const responseText = await this.callOpenAI(systemPrompt, userPrompt);
        return this.cleanAndParseJSON(responseText);
      } catch (err) {
        console.warn('OpenAI Translation failed...', err.message);
      }
    }

    // Simple offline stub
    return {
      ...analysisObject,
      translated: true,
      note: `Translation to ${targetLangName} is not available offline.`
    };
  }

  /**
   * Simulate a what-if scenario by comparing modifications
   */
  async whatIfAnalysis(retrievedContext, modifications) {
    const modsText = modifications.map(m => `- ${m.field}: "${m.original}" → "${m.modified}"`).join('\n');

    const systemPrompt = `You are a legal risk analyst. Compare the risk implications of these contract modifications.`;
    
    const userPrompt = `ORIGINAL DOCUMENT (excerpt):
"""
${retrievedContext}
"""

PROPOSED MODIFICATIONS:
${modsText}

Return ONLY valid JSON (no markdown):
{
  "summary": "Brief overall impact summary",
  "riskChange": "increased|decreased|unchanged",
  "overallBefore": "low|medium|high",
  "overallAfter": "low|medium|high",
  "categories": [
    {
      "name": "Category",
      "scoreBefore": 5,
      "scoreAfter": 7,
      "change": "increased|decreased|unchanged",
      "impact": "Explanation of the change"
    }
  ],
  "implications": ["Implication 1", "Implication 2"],
  "recommendation": "Accept|Negotiate|Reject",
  "reasoning": "Why this recommendation"
}`;

    if (this.primaryProvider === 'gemini' && process.env.GEMINI_API_KEY) {
      try {
        const model = this.getGeminiModel(systemPrompt);
        if (model) {
          const result = await model.generateContent(userPrompt);
          return this.cleanAndParseJSON(result.response.text());
        }
      } catch (err) {
        console.warn('Gemini What-If failed, trying OpenAI...', err.message);
      }
    }

    if (process.env.OPENAI_API_KEY) {
      try {
        const responseText = await this.callOpenAI(systemPrompt, userPrompt);
        return this.cleanAndParseJSON(responseText);
      } catch (err) {
        console.warn('OpenAI What-If failed, using offline fallback...', err.message);
      }
    }

    // Offline simulation fallback
    const riskBefore = 'medium';
    const riskAfter = modifications.some(m => /(penalty|interest|late|indemnity)/i.test(m.field) && parseFloat(m.modified) > parseFloat(m.original)) ? 'high' : 'medium';
    const riskChange = riskAfter === 'high' ? 'increased' : 'unchanged';
    
    return {
      summary: `Based on ${modifications.length} modification(s), overall risk has ${riskChange}.`,
      riskChange,
      overallBefore: riskBefore,
      overallAfter: riskAfter,
      categories: [
        { name: 'Financial Risk', scoreBefore: 5, scoreAfter: riskAfter === 'high' ? 8 : 5, change: riskChange, impact: 'Modified payment or penalty parameters.' }
      ],
      implications: modifications.map(m => `Changing "${m.field}" from "${m.original}" to "${m.modified}" may alter legal exposure.`),
      recommendation: riskAfter === 'high' ? 'Negotiate' : 'Accept',
      reasoning: 'Offline rule estimate based on parameter changes.'
    };
  }

  /**
   * Helper to strip markdown and parse JSON safely
   */
  cleanAndParseJSON(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse AI JSON response, raw text was:', text);
      throw new Error('AI returned an invalid JSON response structure.');
    }
  }
}

module.exports = new AIService();
