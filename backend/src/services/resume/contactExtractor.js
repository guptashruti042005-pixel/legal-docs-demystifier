/**
 * General-Purpose Contact & Entity Extractor
 * Extracts candidate name, email, phone, location, and social links with strict guardrails.
 */

// Technologies with dot-extensions that must NEVER be classified as websites
const TECH_EXTENSIONS_BLOCKLIST = new Set([
  'socket.io',
  'node.js',
  'nodejs',
  'express.js',
  'expressjs',
  'react.js',
  'reactjs',
  'vue.js',
  'vuejs',
  'next.js',
  'nextjs',
  'angular.js',
  'angularjs',
  'moment.js',
  'chart.js',
  'three.js',
  'd3.js',
  'redux.js',
  'mysql',
  'asp.net'
]);

// Email domains that must NEVER be extracted as personal websites
const EMAIL_DOMAINS_BLOCKLIST = new Set([
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
  'mail.com',
  'zoho.com'
]);

class ContactExtractor {
  /**
   * Extracts candidate name from header lines.
   * @param {string} text 
   * @returns {string}
   */
  extractName(text) {
    if (!text || typeof text !== 'string') return '';

    const lines = text.split('\n');
    const headerLines = lines.slice(0, 10);

    const nonNamePatterns = [
      /curriculum\s+vitae/i,
      /^resume$/i,
      /^profile$/i,
      /^summary$/i,
      /@/,
      /\+?\d{2,}/,
      /github\.com/i,
      /linkedin\.com/i,
      /https?:\/\//i,
      /www\./i,
      /page\s+\d+/i,
      /b\.?tech|m\.?tech|b\.?s\.?|m\.?s\.?|ph\.?d|bachelor|master|engineer/i
    ];

    for (let rawLine of headerLines) {
      let line = rawLine.trim();

      // If line contains delimiters like '|', '•', ',', take the first part
      if (line.includes('|')) {
        line = line.split('|')[0].trim();
      } else if (line.includes('•')) {
        line = line.split('•')[0].trim();
      }

      // Skip lines with non-name patterns
      if (nonNamePatterns.some(p => p.test(line))) {
        continue;
      }

      // Remove symbols or titles
      const cleanCandidate = line
        .replace(/^[#*\-•\s]+/, '')
        .replace(/[#*\-•\s]+$/, '')
        .replace(/^(mr\.|mrs\.|ms\.|dr\.)\s+/i, '')
        .trim();

      // Check if it looks like a person's name: 2-4 words, alphabetic, proper length
      const words = cleanCandidate.split(/\s+/);
      if (
        words.length >= 2 &&
        words.length <= 4 &&
        cleanCandidate.length >= 3 &&
        cleanCandidate.length <= 40 &&
        /^[a-zA-Z\s.'-]+$/.test(cleanCandidate)
      ) {
        return cleanCandidate;
      }
    }

    // Fallback: check first non-empty line
    for (let rawLine of headerLines) {
      const line = rawLine.replace(/^[#*\-•\s]+/, '').trim();
      if (line.length > 2 && line.length < 35 && !line.includes('@') && !/\d/.test(line)) {
        return line;
      }
    }

    return '';
  }

  /**
   * Extracts email address.
   * @param {string} text 
   * @returns {string}
   */
  extractEmail(text) {
    if (!text) return '';
    const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
    const matches = text.match(emailRegex);
    if (!matches || matches.length === 0) return '';
    // Return first valid match
    return matches[0].toLowerCase();
  }

  /**
   * Extracts phone number (supports international & domestic formats).
   * @param {string} text 
   * @returns {string}
   */
  extractPhone(text) {
    if (!text) return '';
    // Match +91 98765 43210, +91-9876543210, (555) 123-4567, 9876543210, +1 234 567 8901
    const phoneRegexes = [
      /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{4,5}\b/g,
      /\b\d{10}\b/g
    ];

    for (const regex of phoneRegexes) {
      const matches = text.match(regex);
      if (matches) {
        for (const match of matches) {
          const digitsOnly = match.replace(/\D/g, '');
          // Standard phone numbers have 10 to 13 digits
          if (digitsOnly.length >= 10 && digitsOnly.length <= 13) {
            // Ensure not a year range like 2020-2024
            if (!/^(19|20)\d{2}[-\s](19|20)\d{2}$/.test(match.trim())) {
              return match.trim();
            }
          }
        }
      }
    }

    return '';
  }

  /**
   * Extracts candidate location (City, State / Country).
   * @param {string} text 
   * @returns {string}
   */
  extractLocation(text) {
    if (!text) return '';
    // Only search the top 5 lines of the resume header before any section heading
    const allLines = text.split('\n').slice(0, 6);
    const headerLines = [];
    for (const l of allLines) {
      if (/^(summary|professional\s+summary|technical\s+skills|skills|experience|education|projects)/i.test(l.trim())) {
        break;
      }
      headerLines.push(l);
    }
    const headerText = headerLines.join('\n');

    // Pattern 1: City, State or City, Country
    // e.g. "Jaipur, Rajasthan", "New York, NY", "Bangalore, India", "San Jose, CA"
    const locationRegex = /\b([A-Z][a-zA-Z\s]+),\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?|[A-Z]{2})\b/g;
    let match;

    const skipKeywords = new Set([
      'curriculum vitae', 'resume', 'skills', 'education', 'experience',
      'university', 'institute', 'college', 'school', 'technologies', 'projects',
      'bootstrap', 'tailwind', 'tailwind css', 'react', 'react.js', 'node', 'node.js',
      'express', 'express.js', 'python', 'java', 'javascript', 'html', 'css',
      'sql', 'mysql', 'docker', 'aws', 'git', 'github'
    ]);

    while ((match = locationRegex.exec(headerText)) !== null) {
      const full = match[0].trim();
      const city = match[1].trim();
      const state = match[2].trim();

      if (skipKeywords.has(city.toLowerCase()) || skipKeywords.has(state.toLowerCase())) {
        continue;
      }

      // Ensure city and state look reasonable
      if (city.length > 2 && city.length < 30 && state.length >= 2 && state.length < 30) {
        // Exclude date patterns like "May, 2024"
        const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        if (!months.includes(city.toLowerCase()) && !/^\d+$/.test(state)) {
          return full;
        }
      }
    }

    return '';
  }

  /**
   * Extracts links & URLs with strict guardrails against false positives.
   * @param {string} text 
   * @returns {{ linkedin: string, github: string, portfolio: string, otherLinks: string[] }}
   */
  extractLinks(text) {
    const links = {
      linkedin: '',
      github: '',
      portfolio: '',
      otherLinks: []
    };

    if (!text) return links;

    // 1. Specific LinkedIn Matcher (handles https://www.linkedin.com/in/... or linkedin.com/in/...)
    const linkedinRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)\/?/i;
    const linkedinMatch = text.match(linkedinRegex);
    if (linkedinMatch) {
      links.linkedin = linkedinMatch[0].startsWith('http') ? linkedinMatch[0] : `https://${linkedinMatch[0]}`;
    }

    // 2. Specific GitHub Matcher (handles https://github.com/... or github.com/...)
    const githubRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)\/?/i;
    const githubMatch = text.match(githubRegex);
    if (githubMatch) {
      // Exclude generic github.com without username
      if (githubMatch[1] && !['features', 'topics', 'trending', 'pricing'].includes(githubMatch[1].toLowerCase())) {
        links.github = githubMatch[0].startsWith('http') ? githubMatch[0] : `https://${githubMatch[0]}`;
      }
    }

    // If PDF text contains literal "LinkedIn" or "GitHub" in contact header, record profile presence
    const headerSnippet = text.split('\n').slice(0, 5).join(' ');
    if (!links.linkedin && /\blinkedin\b/i.test(headerSnippet)) {
      links.linkedin = 'https://linkedin.com';
    }
    if (!links.github && /\bgithub\b/i.test(headerSnippet)) {
      links.github = 'https://github.com';
    }

    // 3. Extract other URLs with strict domain validation & guardrails
    // Match URLs with or without http(s)
    const urlRegex = /(?:https?:\/\/|www\.)[^\s<>"'{}|\\^`[\]]+/gi;
    const potentialUrls = text.match(urlRegex) || [];

    // Also look for naked domains in the header (e.g. "portfolio.dev", "leetcode.com/user")
    const headerText = text.split('\n').slice(0, 15).join(' ');
    const nakedDomainRegex = /\b([a-zA-Z0-9-]+\.(?:com|org|net|io|me|dev|app|ai|in)(?:\/[^\s<>"'{}|\\^`[\]]*)?)\b/gi;
    let nakedMatch;
    while ((nakedMatch = nakedDomainRegex.exec(headerText)) !== null) {
      potentialUrls.push(nakedMatch[1]);
    }

    const seenUrls = new Set();
    if (links.linkedin) seenUrls.add(links.linkedin.toLowerCase());
    if (links.github) seenUrls.add(links.github.toLowerCase());

    for (const rawUrl of potentialUrls) {
      let cleanUrl = rawUrl.replace(/[.,;:)]+$/, '').trim();
      const lowerUrl = cleanUrl.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
      const domain = lowerUrl.split('/')[0];

      // GUARDRAIL 1: Disallow technologies (Socket.io, Node.js, Express.js, etc.)
      if (TECH_EXTENSIONS_BLOCKLIST.has(domain) || TECH_EXTENSIONS_BLOCKLIST.has(lowerUrl)) {
        continue;
      }

      // GUARDRAIL 2: Disallow email domains (gmail.com, etc.)
      if (EMAIL_DOMAINS_BLOCKLIST.has(domain)) {
        continue;
      }

      // GUARDRAIL 3: Skip already recorded LinkedIn / GitHub
      if (domain.includes('linkedin.com') || domain.includes('github.com')) {
        continue;
      }

      // Normalize scheme
      const fullUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;

      if (seenUrls.has(fullUrl.toLowerCase())) {
        continue;
      }
      seenUrls.add(fullUrl.toLowerCase());

      // Identify portfolio vs other links (LeetCode, HackerRank, Twitter, Medium)
      if (
        domain.includes('portfolio') ||
        domain.includes('vercel.app') ||
        domain.includes('netlify.app') ||
        domain.includes('.me') ||
        domain.includes('.dev') ||
        (!links.portfolio && !domain.includes('leetcode') && !domain.includes('codechef') && !domain.includes('medium'))
      ) {
        if (!links.portfolio) {
          links.portfolio = fullUrl;
          continue;
        }
      }

      links.otherLinks.push(fullUrl);
    }

    return links;
  }

  /**
   * Extracts all contact information from resume text.
   * @param {string} text 
   * @returns {{ name: string, email: string, phone: string, location: string, linkedin: string, github: string, portfolio: string, otherLinks: string[] }}
   */
  extractAll(text) {
    const links = this.extractLinks(text);
    return {
      name: this.extractName(text),
      email: this.extractEmail(text),
      phone: this.extractPhone(text),
      location: this.extractLocation(text),
      linkedin: links.linkedin,
      github: links.github,
      portfolio: links.portfolio,
      otherLinks: links.otherLinks
    };
  }
}

module.exports = new ContactExtractor();
