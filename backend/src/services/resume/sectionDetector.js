/**
 * Semantic Resume Section Detector
 * Identifies standard and non-standard resume section headings and segments text into logical blocks.
 */

const SECTION_PATTERNS = [
  {
    type: 'summary',
    regex: /^(summary|professional\s+summary|executive\s+summary|career\s+profile|about\s+me|profile|objective|career\s+objective|personal\s+profile)$/i
  },
  {
    type: 'experience',
    regex: /^(experience|work\s+experience|professional\s+experience|employment\s+history|career\s+history|work\s+history|internships|practical\s+experience|relevant\s+experience|employment)$/i
  },
  {
    type: 'education',
    regex: /^(education|educational\s+background|academic\s+background|academic\s+qualifications|educational\s+qualifications|degrees|academics|studies)$/i
  },
  {
    type: 'skills',
    regex: /^(skills|technical\s+skills|core\s+competencies|technologies|tech\s+stack|technical\s+proficiencies|tools\s*(&|and)\s*concepts|key\s+skills|areas?\s+of\s+expertise|technical\s+expertise|technical\s+stack|computer\s+skills)$/i
  },
  {
    type: 'projects',
    regex: /^(projects|personal\s+projects|academic\s+projects|technical\s+projects|selected\s+projects|software\s+projects|key\s+projects)$/i
  },
  {
    type: 'certifications',
    regex: /^(certifications?|licenses?\s*(&|and)\s*certifications?|certificates?|courses|trainings?|accreditations?|professional\s+certifications?)$/i
  },
  {
    type: 'achievements',
    regex: /^(achievements?|accomplishments?|awards?|honors?|key\s+achievements?|extracurricular\s*(&|and)\s*achievements?|honors?\s*(&|and)\s*awards?|awards?\s*(&|and)\s*achievements?)$/i
  },
  {
    type: 'publications',
    regex: /^(publications?|research\s+papers?|conferences?|research)$/i
  },
  {
    type: 'volunteer',
    regex: /^(volunteer\s+experience|community\s+service|leadership|extracurricular\s+activities|extracurriculars?|volunteer\s+work)$/i
  },
  {
    type: 'languages',
    regex: /^(languages?|language\s+proficienc(y|ies))$/i
  }
];

class SectionDetector {
  /**
   * Checks if a line matches a known resume section heading.
   * @param {string} line 
   * @returns {{ type: string, heading: string } | null}
   */
  classifyHeading(line) {
    if (!line || typeof line !== 'string') return null;

    const trimmed = line.trim();
    // Headings are typically 1-6 words, under 50 chars, and don't start with bullets or numbers
    if (trimmed.length === 0 || trimmed.length > 55) return null;
    if (trimmed.startsWith('•') || /^\d+\./.test(trimmed)) return null;

    // Strip trailing colons, dashes, pipes, underlines
    const cleanHeading = trimmed
      .replace(/[:|–—\-]+$/, '')
      .replace(/^[:|–—\-]+/, '')
      .trim();

    if (cleanHeading.length === 0) return null;

    for (const pattern of SECTION_PATTERNS) {
      if (pattern.regex.test(cleanHeading)) {
        return {
          type: pattern.type,
          heading: cleanHeading
        };
      }
    }

    return null;
  }

  /**
   * Segments a resume into structured sections.
   * Content before the first detected section heading is labeled as 'header'.
   * @param {string} text 
   * @returns {Array<{ type: string, heading: string, content: string, lines: string[] }>}
   */
  detectSections(text) {
    if (!text || typeof text !== 'string') return [];

    const lines = text.split('\n');
    const sections = [];
    let currentSection = {
      type: 'header',
      heading: 'Header',
      lines: []
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check for markdown heading markers (# Education) or underline rows (=== or ---)
      let headingCandidate = trimmed;
      if (headingCandidate.startsWith('#')) {
        headingCandidate = headingCandidate.replace(/^#+\s*/, '');
      }

      const match = this.classifyHeading(headingCandidate);

      if (match) {
        // If the current section has lines, push it
        if (currentSection.lines.length > 0) {
          sections.push({
            type: currentSection.type,
            heading: currentSection.heading,
            content: currentSection.lines.join('\n').trim(),
            lines: [...currentSection.lines]
          });
        }

        // Start new section
        currentSection = {
          type: match.type,
          heading: match.heading,
          lines: []
        };

        // If the next line is an underline (e.g. "------" or "======"), skip it
        if (i + 1 < lines.length && /^[-=_]{3,}$/.test(lines[i + 1].trim())) {
          i++;
        }
      } else {
        currentSection.lines.push(line);
      }
    }

    // Push the final section
    if (currentSection.lines.length > 0) {
      sections.push({
        type: currentSection.type,
        heading: currentSection.heading,
        content: currentSection.lines.join('\n').trim(),
        lines: [...currentSection.lines]
      });
    }

    return sections;
  }

  /**
   * Retrieves content of a specific section type.
   * @param {string} text 
   * @param {string} type 
   * @returns {string}
   */
  getSectionContent(text, type) {
    const sections = this.detectSections(text);
    const target = sections.find(s => s.type === type);
    return target ? target.content : '';
  }
}

module.exports = new SectionDetector();
