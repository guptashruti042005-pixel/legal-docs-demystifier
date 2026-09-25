/**
 * Core Resume Parsing & Normalization Service
 * Provides both offline deterministic parsing and LLM schema validation / enrichment.
 */

const resumeCleaner = require('./resumeCleaner');
const sectionDetector = require('./sectionDetector');
const skillTaxonomy = require('./skillTaxonomy');
const contactExtractor = require('./contactExtractor');
const atsScorer = require('./atsScorer');

class ResumeParserService {
  /**
   * Deterministic rule-based resume parser for offline execution or baseline extraction.
   * @param {string} rawText 
   * @param {string} jobDescription 
   * @returns {Object} Full structured resume analysis object
   */
  parseFromText(rawText, jobDescription = '') {
    const cleanedText = resumeCleaner.clean(rawText);
    const sections = sectionDetector.detectSections(cleanedText);

    // 1. Extract Personal Info & Contacts
    const personalInfo = contactExtractor.extractAll(cleanedText);

    // 2. Extract Summary
    let summary = '';
    const summarySection = sections.find(s => s.type === 'summary');
    if (summarySection && summarySection.content) {
      summary = summarySection.content.replace(/\n+/g, ' ').trim();
    } else {
      // Check header or early lines for a concise intro paragraph
      const headerSection = sections.find(s => s.type === 'header');
      if (headerSection && headerSection.lines.length > 2) {
        const candidateLines = headerSection.lines.filter(l => {
          const t = l.trim();
          return t.length > 40 && !t.includes('@') && !t.includes('http') && !t.includes('|');
        });
        if (candidateLines.length > 0) {
          summary = candidateLines.join(' ').trim();
        }
      }
    }

    // 3. Extract & Canonicalize Skills
    const skillsSection = sections.find(s => s.type === 'skills');
    let extractedSkills = [];
    if (skillsSection && skillsSection.content) {
      // First try taxonomy extraction from the dedicated skills section
      extractedSkills = skillTaxonomy.extractSkillsFromText(skillsSection.content);

      // If taxonomy didn't find enough, split on commas/bullets/newlines and normalize
      if (extractedSkills.length < 3) {
        const rawTokens = skillsSection.content
          .split(/[\n•,*|;]/)
          .map(t => t.replace(/^(languages|frameworks|tools|database|technologies|backend|frontend)[:\s]*/i, '').trim())
          .filter(t => t.length > 1 && t.length < 35);
        extractedSkills = skillTaxonomy.canonicalizeList([...extractedSkills, ...rawTokens]);
      }
    }

    // If skills are still low, scan entire resume for known taxonomy skills
    if (extractedSkills.length < 5) {
      const globalSkills = skillTaxonomy.extractSkillsFromText(cleanedText);
      extractedSkills = skillTaxonomy.canonicalizeList([...extractedSkills, ...globalSkills]);
    } else {
      extractedSkills = skillTaxonomy.canonicalizeList(extractedSkills);
    }

    // 4. Extract Experience
    const experience = this._parseExperience(sections.find(s => s.type === 'experience'));

    // 5. Extract Education
    const education = this._parseEducation(sections.find(s => s.type === 'education'));

    // 6. Extract Projects
    const projects = this._parseProjects(sections.find(s => s.type === 'projects'));

    // 7. Extract Certifications
    const certifications = this._parseCertifications(sections.find(s => s.type === 'certifications'));

    // 8. Extract Achievements
    const achievements = this._parseAchievements(sections.find(s => s.type === 'achievements'));

    const parsedData = {
      personalInfo,
      summary,
      skills: extractedSkills,
      experience,
      education,
      projects,
      certifications,
      achievements
    };

    // 9. Compute ATS Score & Breakdown
    const atsResult = atsScorer.calculateAtsScore(parsedData, cleanedText);

    // 10. Job Description Matching
    const jobDescriptionMatch = atsScorer.matchJobDescription(extractedSkills, cleanedText, jobDescription);

    return {
      documentType: 'resume',
      personalInfo,
      summary,
      skills: extractedSkills,
      experience,
      education,
      projects,
      certifications,
      achievements,
      atsScore: atsResult.score,
      atsScoreBreakdown: atsResult.breakdown,
      atsAssessment: atsResult.assessment,
      jobDescriptionMatch,
      resumeFeedback: {
        strengths: this._generateStrengths(parsedData),
        improvements: atsResult.feedback,
        atsChecklist: [
          { item: 'Contact details clearly listed', passed: Boolean(personalInfo.email && personalInfo.phone) },
          { item: 'Standard section headings used', passed: sections.length >= 3 },
          { item: 'Technical skills populated', passed: extractedSkills.length >= 5 },
          { item: 'Hands-on projects or experience documented', passed: (projects.length > 0 || experience.length > 0) },
          { item: 'Education history documented', passed: education.length > 0 }
        ]
      }
    };
  }

  /**
   * Validates, cleans, and normalizes output from the LLM to guarantee schema compliance.
   * @param {Object} llmOutput 
   * @param {string} rawText 
   * @param {string} jobDescription 
   * @returns {Object}
   */
  normalizeAndValidate(llmOutput = {}, rawText = '', jobDescription = '') {
    const cleanedText = resumeCleaner.clean(rawText);
    const baseline = this.parseFromText(cleanedText, jobDescription);

    const result = {
      documentType: 'resume',
      personalInfo: { ...baseline.personalInfo },
      summary: '',
      skills: [],
      experience: [],
      education: [],
      projects: [],
      certifications: [],
      achievements: [],
      atsScore: 0,
      atsScoreBreakdown: {},
      atsAssessment: '',
      jobDescriptionMatch: null,
      resumeFeedback: {
        strengths: [],
        improvements: [],
        atsChecklist: []
      }
    };

    // 1. Personal Info Merge & Guardrails
    if (llmOutput.personalInfo && typeof llmOutput.personalInfo === 'object') {
      const p = llmOutput.personalInfo;
      result.personalInfo.name = (p.name && typeof p.name === 'string' && p.name.trim().length > 1) 
        ? p.name.trim() 
        : baseline.personalInfo.name;

      result.personalInfo.email = (p.email && /@/.test(p.email)) 
        ? p.email.trim().toLowerCase() 
        : baseline.personalInfo.email;

      result.personalInfo.phone = (p.phone && /\d{4,}/.test(p.phone)) 
        ? p.phone.trim() 
        : baseline.personalInfo.phone;

      result.personalInfo.location = (p.location && typeof p.location === 'string' && p.location.trim().length > 2) 
        ? p.location.trim() 
        : baseline.personalInfo.location;

      // Filter URLs through guardrails (no tech names, no gmail.com)
      const sanitizedLinks = contactExtractor.extractLinks(
        [p.linkedin, p.github, p.portfolio, ...(Array.isArray(p.otherLinks) ? p.otherLinks : [])].filter(Boolean).join(' ')
      );

      result.personalInfo.linkedin = sanitizedLinks.linkedin || baseline.personalInfo.linkedin;
      result.personalInfo.github = sanitizedLinks.github || baseline.personalInfo.github;
      result.personalInfo.portfolio = sanitizedLinks.portfolio || baseline.personalInfo.portfolio;
      result.personalInfo.otherLinks = Array.from(new Set([...(sanitizedLinks.otherLinks || []), ...(baseline.personalInfo.otherLinks || [])]));
    }

    // 2. Summary
    if (typeof llmOutput.summary === 'string' && llmOutput.summary.trim().length > 10) {
      result.summary = llmOutput.summary.trim();
    } else {
      result.summary = baseline.summary;
    }

    // 3. Skills: Canonicalize both LLM and baseline
    const combinedSkills = [
      ...(Array.isArray(llmOutput.skills) ? llmOutput.skills : []),
      ...baseline.skills
    ];
    result.skills = skillTaxonomy.canonicalizeList(combinedSkills);

    // 4. Experience
    if (Array.isArray(llmOutput.experience) && llmOutput.experience.length > 0) {
      result.experience = llmOutput.experience.map(exp => ({
        role: exp.role || exp.title || exp.position || 'Software Professional',
        company: exp.company || exp.organization || '',
        location: exp.location || '',
        duration: exp.duration || exp.dates || (exp.startDate ? `${exp.startDate} - ${exp.endDate || 'Present'}` : ''),
        description: Array.isArray(exp.description) ? exp.description : (typeof exp.description === 'string' ? [exp.description] : [])
      }));
    } else {
      result.experience = baseline.experience;
    }

    // 5. Education
    if (Array.isArray(llmOutput.education) && llmOutput.education.length > 0) {
      result.education = llmOutput.education.map(edu => ({
        degree: edu.degree || edu.qualification || 'Degree',
        institution: edu.institution || edu.college || edu.university || edu.school || '',
        location: edu.location || '',
        year: edu.year || edu.duration || edu.graduationDate || '',
        score: edu.score || edu.cgpa || edu.gpa || edu.percentage || ''
      }));
    } else {
      result.education = baseline.education;
    }

    // 6. Projects
    if (Array.isArray(llmOutput.projects) && llmOutput.projects.length > 0) {
      result.projects = llmOutput.projects.map(proj => ({
        name: proj.name || proj.title || 'Project',
        description: Array.isArray(proj.description) ? proj.description : (typeof proj.description === 'string' ? [proj.description] : []),
        technologies: Array.isArray(proj.technologies) 
          ? skillTaxonomy.canonicalizeList(proj.technologies)
          : (typeof proj.technologies === 'string' ? skillTaxonomy.canonicalizeList(proj.technologies.split(/[,|]/)) : []),
        url: proj.url || proj.link || ''
      }));
    } else {
      result.projects = baseline.projects;
    }

    // 7. Certifications
    if (Array.isArray(llmOutput.certifications) && llmOutput.certifications.length > 0) {
      result.certifications = llmOutput.certifications.map(c => ({
        name: typeof c === 'string' ? c : (c.name || c.title || 'Certification'),
        issuer: typeof c === 'object' ? (c.issuer || c.organization || '') : '',
        date: typeof c === 'object' ? (c.date || c.year || '') : '',
        credentialUrl: typeof c === 'object' ? (c.credentialUrl || c.url || '') : ''
      }));
    } else {
      result.certifications = baseline.certifications;
    }

    // 8. Achievements
    if (Array.isArray(llmOutput.achievements) && llmOutput.achievements.length > 0) {
      result.achievements = llmOutput.achievements.map(a => typeof a === 'string' ? a : (a.title || a.description || JSON.stringify(a)));
    } else {
      result.achievements = baseline.achievements;
    }

    // 9. ATS Scoring & Breakdown
    const calculatedAts = atsScorer.calculateAtsScore(result, cleanedText);
    result.atsScore = calculatedAts.score;
    result.atsScoreBreakdown = calculatedAts.breakdown;
    result.atsAssessment = calculatedAts.assessment;

    // 10. Job Description Match
    if (jobDescription && jobDescription.trim().length >= 20) {
      if (llmOutput.jobDescriptionMatch && typeof llmOutput.jobDescriptionMatch === 'object') {
        result.jobDescriptionMatch = {
          matchPercentage: Number(llmOutput.jobDescriptionMatch.matchPercentage) || calculatedAts.score,
          matchedSkills: Array.isArray(llmOutput.jobDescriptionMatch.matchedSkills) 
            ? skillTaxonomy.canonicalizeList(llmOutput.jobDescriptionMatch.matchedSkills) 
            : [],
          missingSkills: Array.isArray(llmOutput.jobDescriptionMatch.missingSkills) 
            ? skillTaxonomy.canonicalizeList(llmOutput.jobDescriptionMatch.missingSkills) 
            : [],
          summary: llmOutput.jobDescriptionMatch.summary || '',
          suggestions: Array.isArray(llmOutput.jobDescriptionMatch.suggestions) 
            ? llmOutput.jobDescriptionMatch.suggestions 
            : []
        };
      } else {
        result.jobDescriptionMatch = atsScorer.matchJobDescription(result.skills, cleanedText, jobDescription);
      }
    } else {
      result.jobDescriptionMatch = null;
    }

    // 11. Resume Feedback
    result.resumeFeedback = {
      strengths: (llmOutput.resumeFeedback && Array.isArray(llmOutput.resumeFeedback.strengths) && llmOutput.resumeFeedback.strengths.length > 0)
        ? llmOutput.resumeFeedback.strengths
        : this._generateStrengths(result),
      improvements: (llmOutput.resumeFeedback && Array.isArray(llmOutput.resumeFeedback.improvements) && llmOutput.resumeFeedback.improvements.length > 0)
        ? llmOutput.resumeFeedback.improvements
        : calculatedAts.feedback,
      atsChecklist: baseline.resumeFeedback.atsChecklist
    };

    return result;
  }

  // --- Internal Rule-based Parsers ---

  _isEntryTitleLine(line) {
    if (!line || typeof line !== 'string') return false;
    const trimmed = line.trim();
    if (trimmed.length < 3 || trimmed.length > 120) return false;

    // Bullet lines are not titles
    if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) return false;

    // Continuation lines start with lowercase, punctuation, or conjunctions
    if (/^[a-z]/.test(trimmed)) return false;
    if (/^(and|for|to|with|in|by|or|from|at|on|using|across|into)\b/i.test(trimmed)) return false;

    // Full sentences ending in period are continuation bullets, not titles
    if (/\.\s*$/.test(trimmed)) return false;

    // Must start with an uppercase letter or number (e.g. "1. Project")
    return /^[A-Z0-9]/.test(trimmed);
  }

  _segmentEntries(content) {
    if (!content) return [];
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    const entries = [];
    let currentLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isTitle = this._isEntryTitleLine(line);

      // If we encounter a new title line and currentLines already has lines with bullets,
      // that indicates the previous entry is complete and a new entry is starting!
      if (isTitle && currentLines.length > 0 && currentLines.some(l => l.startsWith('•') || l.startsWith('-') || l.startsWith('*'))) {
        entries.push(currentLines);
        currentLines = [line];
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0) {
      entries.push(currentLines);
    }

    return entries;
  }

  _parseExperience(section) {
    if (!section || !section.content) return [];
    const entries = [];
    const entryGroups = this._segmentEntries(section.content);

    for (const lines of entryGroups) {
      if (lines.length === 0) continue;

      let role = '';
      let company = '';
      let duration = '';
      let location = '';
      const bullets = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Date detection
        const dateMatch = line.match(/\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?\d{4}\s*[-–—to]+\s*(?:(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?\d{4}|present|current)\b/i) || line.match(/\b(19|20)\d{2}\b/);
        if (dateMatch && !duration) {
          duration = dateMatch[0];
        }

        if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
          bullets.push(line.replace(/^[•\s*-]+/, '').trim());
        } else if (!role) {
          let lineNoDate = line;
          if (dateMatch) {
            lineNoDate = line.replace(dateMatch[0], '').trim();
          }

          if (lineNoDate.includes('|')) {
            const parts = lineNoDate.split('|').map(p => p.trim());
            role = parts[0];
            company = parts[1] || '';
            if (parts[2] && !duration) duration = parts[2];
          } else if (lineNoDate.includes(' – ') || lineNoDate.includes(' - ')) {
            const parts = lineNoDate.split(/[–-]/).map(p => p.trim());
            role = parts[0];
            company = parts[1] || '';
          } else if (/\bat\b/i.test(lineNoDate)) {
            const parts = lineNoDate.split(/\bat\b/i).map(p => p.trim());
            role = parts[0];
            company = parts[1] || '';
          } else {
            role = lineNoDate;
          }
        } else if (!company && !dateMatch) {
          company = line;
        } else if (bullets.length > 0) {
          // Wrapped continuation of the previous bullet point
          bullets[bullets.length - 1] = `${bullets[bullets.length - 1]} ${line}`.trim();
        } else if (line.length > 20) {
          bullets.push(line);
        }
      }

      if (role || company) {
        entries.push({
          role: role || 'Professional Role',
          company: company || '',
          location,
          duration,
          description: bullets
        });
      }
    }

    return entries;
  }

  _parseEducation(section) {
    if (!section || !section.content) return [];
    const entries = [];
    const rawBlocks = section.content.split(/\n{2,}/);
    const blocks = rawBlocks.length > 1 ? rawBlocks : [section.content];

    for (const block of blocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) continue;

      let degree = '';
      let institution = '';
      let year = '';
      let score = '';

      for (const line of lines) {
        // Degree detection
        if (/b\.?tech|bachelor|master|m\.?tech|b\.?s\.?|m\.?s\.?|ph\.?d|high\s+school|secondary|diploma|class\s+(x|xii)/i.test(line) && !degree) {
          degree = line;
        } else if (/university|college|institute|school|academy/i.test(line) && !institution) {
          institution = line;
        }

        // Score / CGPA detection
        const scoreMatch = line.match(/\b(?:cgpa|gpa|percentage|score|marks?)[:\s]*([0-9.]+(?:\s*\/\s*[0-9.]+)?%?)/i) || line.match(/([0-9.]+)(?:\s*\/\s*10|%)/);
        if (scoreMatch && !score) {
          score = scoreMatch[0].trim();
        }

        // Year / Date detection
        const dateMatch = line.match(/\b(?:19|20)\d{2}\s*[-–—to]+\s*(?:(?:19|20)\d{2}|present|expected)\b/i) || line.match(/\b(19|20)\d{2}\b/);
        if (dateMatch && !year) {
          year = dateMatch[0];
        }
      }

      if (degree || institution) {
        entries.push({
          degree: degree || lines[0],
          institution: institution || (lines.length > 1 ? lines[1] : ''),
          location: '',
          year,
          score
        });
      }
    }

    return entries;
  }

  _parseProjects(section) {
    if (!section || !section.content) return [];
    const entries = [];
    const entryGroups = this._segmentEntries(section.content);

    for (const lines of entryGroups) {
      if (lines.length === 0) continue;

      let name = '';
      let techLine = '';
      let projectUrl = '';
      const bullets = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // URL detection
        const urlMatch = line.match(/https?:\/\/[^\s)]+/);
        if (urlMatch && !projectUrl) {
          projectUrl = urlMatch[0];
        }

        if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
          bullets.push(line.replace(/^[•\s*-]+/, '').trim());
        } else if (!name) {
          let titleCandidate = line;

          if (line.includes('|')) {
            const parts = line.split('|').map(p => p.trim());
            titleCandidate = parts[0];
            techLine = parts.slice(1).join(', ');
          } else if (line.includes(' – ') || line.includes(' - ')) {
            const parts = line.split(/[–-]/).map(p => p.trim());
            titleCandidate = parts[0];
            techLine = parts.slice(1).join(', ');
          } else if (line.includes('(') && line.includes(')')) {
            const m = line.match(/^(.*?)\s*\((.*?)\)/);
            if (m) {
              titleCandidate = m[1].trim();
              techLine = m[2].trim();
            }
          }

          // If skills/tech terms are concatenated at the end of the title line without delimiter
          const matchedSkills = skillTaxonomy.extractSkillsFromText(line);
          if (matchedSkills.length > 0 && !techLine) {
            techLine = matchedSkills.join(', ');
            let minSkillIdx = -1;
            for (const sk of matchedSkills) {
              const idx = titleCandidate.toLowerCase().indexOf(sk.toLowerCase());
              if (idx > 3 && (minSkillIdx === -1 || idx < minSkillIdx)) {
                minSkillIdx = idx;
              }
            }
            if (minSkillIdx > 3) {
              titleCandidate = titleCandidate.slice(0, minSkillIdx).trim();
            }
          }

          name = titleCandidate.replace(/^[•\s*-]+/, '').replace(/[:|–—\-,]+$/, '').trim();
        } else if (/^(tech|technologies|tools|stack)[:\s]/i.test(line)) {
          techLine = line.replace(/^(tech|technologies|tools|stack)[:\s]*/i, '').trim();
        } else if (bullets.length > 0) {
          // Wrapped continuation of the previous bullet point
          bullets[bullets.length - 1] = `${bullets[bullets.length - 1]} ${line}`.trim();
        } else if (line.length > 25) {
          bullets.push(line);
        }
      }

      if (name) {
        const technologies = techLine 
          ? skillTaxonomy.canonicalizeList(techLine.split(/[,|]/))
          : skillTaxonomy.extractSkillsFromText(bullets.join(' '));

        entries.push({
          name: name.replace(/^[•\s*-]+/, '').replace(/[:|–—\-]+$/, '').trim(),
          description: bullets,
          technologies,
          url: projectUrl
        });
      }
    }

    return entries;
  }

  _parseCertifications(section) {
    if (!section || !section.content) return [];
    const entries = [];
    const lines = section.content.split('\n').map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      const clean = line.replace(/^[•\s*-]+/, '').trim();
      if (!clean) continue;

      let name = clean;
      let issuer = '';
      let date = '';

      if (clean.includes('|')) {
        const parts = clean.split('|').map(p => p.trim());
        name = parts[0];
        issuer = parts[1] || '';
        date = parts[2] || '';
      } else if (clean.includes(' - ')) {
        const parts = clean.split(' - ').map(p => p.trim());
        name = parts[0];
        issuer = parts[1] || '';
      }

      entries.push({
        name,
        issuer,
        date,
        credentialUrl: ''
      });
    }

    return entries;
  }

  _parseAchievements(section) {
    if (!section || !section.content) return [];
    return section.content
      .split('\n')
      .map(l => l.replace(/^[•\s*-]+/, '').trim())
      .filter(l => l.length > 5);
  }

  _generateStrengths(data) {
    const strengths = [];
    if (data.skills && data.skills.length >= 8) {
      strengths.push(`Extensive technical skills profile covering ${data.skills.length} identified competencies.`);
    }
    if (data.projects && data.projects.length >= 2) {
      strengths.push(`Demonstrates practical engineering application across ${data.projects.length} documented projects.`);
    }
    if (data.education && data.education.length > 0) {
      strengths.push('Clear academic qualifications with verified institution and degree details.');
    }
    if (data.experience && data.experience.length > 0) {
      strengths.push(`Proven professional industry/internship experience across ${data.experience.length} roles.`);
    }
    if (data.personalInfo && (data.personalInfo.github || data.personalInfo.linkedin)) {
      strengths.push('Professional portfolio and social links included for recruiter verification.');
    }
    return strengths;
  }
}

module.exports = new ResumeParserService();
