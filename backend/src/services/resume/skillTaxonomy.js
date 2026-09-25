/**
 * Comprehensive Skill Taxonomy & Canonicalization Engine
 * Handles alias normalization, deduplication, categorization, and strict non-merges.
 */

// Canonical alias dictionary (lowercase -> Canonical Name)
const ALIAS_MAP = {
  // Languages
  'javascript': 'JavaScript',
  'js': 'JavaScript',
  'typescript': 'TypeScript',
  'ts': 'TypeScript',
  'python': 'Python',
  'python3': 'Python',
  'java': 'Java',
  'c++': 'C++',
  'cpp': 'C++',
  'c#': 'C#',
  'csharp': 'C#',
  'c': 'C',
  'golang': 'Go',
  'go': 'Go',
  'rust': 'Rust',
  'ruby': 'Ruby',
  'php': 'PHP',
  'swift': 'Swift',
  'kotlin': 'Kotlin',
  'r': 'R',
  'sql': 'SQL',
  'html': 'HTML5',
  'html5': 'HTML5',
  'css': 'CSS3',
  'css3': 'CSS3',

  // Frontend
  'react': 'React',
  'react.js': 'React',
  'reactjs': 'React',
  'react js': 'React',
  'react native': 'React Native',
  'next.js': 'Next.js',
  'nextjs': 'Next.js',
  'vue': 'Vue.js',
  'vue.js': 'Vue.js',
  'vuejs': 'Vue.js',
  'angular': 'Angular',
  'angular.js': 'Angular',
  'angularjs': 'Angular',
  'svelte': 'Svelte',
  'redux': 'Redux',
  'tailwind': 'Tailwind CSS',
  'tailwindcss': 'Tailwind CSS',
  'tailwind css': 'Tailwind CSS',
  'bootstrap': 'Bootstrap',
  'jquery': 'jQuery',
  'sass': 'SASS/SCSS',
  'scss': 'SASS/SCSS',
  'material ui': 'Material UI',
  'mui': 'Material UI',
  'webpack': 'Webpack',
  'vite': 'Vite',

  // Backend
  'node': 'Node.js',
  'node.js': 'Node.js',
  'nodejs': 'Node.js',
  'node js': 'Node.js',
  'express': 'Express.js',
  'express.js': 'Express.js',
  'expressjs': 'Express.js',
  'express js': 'Express.js',
  'nestjs': 'NestJS',
  'django': 'Django',
  'flask': 'Flask',
  'fastapi': 'FastAPI',
  'spring': 'Spring Boot',
  'spring boot': 'Spring Boot',
  'ruby on rails': 'Ruby on Rails',
  'rails': 'Ruby on Rails',
  'asp.net': 'ASP.NET',
  '.net': '.NET',
  'socket.io': 'Socket.io',
  'socketio': 'Socket.io',
  'graphql': 'GraphQL',
  'rest': 'REST APIs',
  'rest api': 'REST APIs',
  'rest apis': 'REST APIs',
  'restful': 'REST APIs',
  'restful api': 'REST APIs',
  'restful apis': 'REST APIs',
  'microservices': 'Microservices',

  // Databases
  'mongodb': 'MongoDB',
  'mongo': 'MongoDB',
  'postgresql': 'PostgreSQL',
  'postgres': 'PostgreSQL',
  'mysql': 'MySQL',
  'sqlite': 'SQLite',
  'redis': 'Redis',
  'oracle': 'Oracle DB',
  'dynamodb': 'DynamoDB',
  'cassandra': 'Cassandra',
  'firebase': 'Firebase',
  'supabase': 'Supabase',
  'elasticsearch': 'Elasticsearch',

  // Cloud & DevOps
  'aws': 'AWS',
  'amazon web services': 'AWS',
  'azure': 'Azure',
  'microsoft azure': 'Azure',
  'gcp': 'Google Cloud (GCP)',
  'google cloud': 'Google Cloud (GCP)',
  'google cloud platform': 'Google Cloud (GCP)',
  'docker': 'Docker',
  'kubernetes': 'Kubernetes',
  'k8s': 'Kubernetes',
  'ci/cd': 'CI/CD',
  'cicd': 'CI/CD',
  'jenkins': 'Jenkins',
  'github actions': 'GitHub Actions',
  'terraform': 'Terraform',
  'nginx': 'Nginx',
  'linux': 'Linux',

  // AI & Data
  'machine learning': 'Machine Learning',
  'deep learning': 'Deep Learning',
  'nlp': 'NLP',
  'natural language processing': 'Natural Language Processing',
  'computer vision': 'Computer Vision',
  'pytorch': 'PyTorch',
  'tensorflow': 'TensorFlow',
  'keras': 'Keras',
  'scikit-learn': 'Scikit-Learn',
  'sklearn': 'Scikit-Learn',
  'pandas': 'Pandas',
  'numpy': 'NumPy',
  'rag': 'RAG',
  'langchain': 'LangChain',
  'llm': 'LLMs',
  'llms': 'LLMs',
  'generative ai': 'Generative AI',
  'genai': 'Generative AI',

  // Tools & Methodologies
  'git': 'Git',
  'github': 'GitHub',
  'gitlab': 'GitLab',
  'postman': 'Postman',
  'jira': 'Jira',
  'agile': 'Agile',
  'scrum': 'Scrum',
  'figma': 'Figma',
  'vs code': 'VS Code',
  'vscode': 'VS Code',
  'dsa': 'Data Structures & Algorithms',
  'data structures': 'Data Structures & Algorithms',
  'algorithms': 'Data Structures & Algorithms',
  'oop': 'Object-Oriented Programming (OOP)',
  'oops': 'Object-Oriented Programming (OOP)'
};

// Category taxonomy
const CATEGORY_MAP = {
  'Programming Languages': [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'C', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'R', 'SQL', 'HTML5', 'CSS3'
  ],
  'Frontend': [
    'React', 'React Native', 'Next.js', 'Vue.js', 'Angular', 'Svelte', 'Redux', 'Tailwind CSS', 'Bootstrap', 'jQuery', 'SASS/SCSS', 'Material UI', 'Webpack', 'Vite'
  ],
  'Backend & APIs': [
    'Node.js', 'Express.js', 'NestJS', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'Ruby on Rails', 'ASP.NET', '.NET', 'Socket.io', 'GraphQL', 'REST APIs', 'Microservices'
  ],
  'Databases': [
    'MongoDB', 'PostgreSQL', 'MySQL', 'SQLite', 'Redis', 'Oracle DB', 'DynamoDB', 'Cassandra', 'Firebase', 'Supabase', 'Elasticsearch'
  ],
  'Cloud & DevOps': [
    'AWS', 'Azure', 'Google Cloud (GCP)', 'Docker', 'Kubernetes', 'CI/CD', 'Jenkins', 'GitHub Actions', 'Terraform', 'Nginx', 'Linux'
  ],
  'AI / ML & Data': [
    'Machine Learning', 'Deep Learning', 'NLP', 'Natural Language Processing', 'Computer Vision', 'PyTorch', 'TensorFlow', 'Keras', 'Scikit-Learn', 'Pandas', 'NumPy', 'RAG', 'LangChain', 'LLMs', 'Generative AI'
  ],
  'Tools & Concepts': [
    'Git', 'GitHub', 'GitLab', 'Postman', 'Jira', 'Agile', 'Scrum', 'Figma', 'VS Code', 'Data Structures & Algorithms', 'Object-Oriented Programming (OOP)'
  ]
};

class SkillTaxonomy {
  /**
   * Normalizes a raw skill string into its canonical form.
   * Preserves capitalization if not found in alias map.
   * @param {string} rawSkill 
   * @returns {string} Canonical skill name
   */
  normalizeSkill(rawSkill) {
    if (!rawSkill || typeof rawSkill !== 'string') return '';
    const clean = rawSkill.trim().replace(/^[-•*,\s]+/, '').replace(/[-•*,\s]+$/, '');
    if (!clean) return '';

    const lower = clean.toLowerCase();
    if (ALIAS_MAP[lower]) {
      return ALIAS_MAP[lower];
    }

    // Return with clean capitalization (capitalize first letter of each word if not all caps)
    if (/^[A-Z0-9\W]+$/.test(clean) && clean.length > 4) {
      return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
    }
    return clean;
  }

  /**
   * Deduplicates and normalizes an array of skills while respecting strict non-merges.
   * (e.g. Java and JavaScript will both be preserved separately).
   * @param {string[]} skillList 
   * @returns {string[]} Canonical, deduplicated skill list
   */
  canonicalizeList(skillList) {
    if (!Array.isArray(skillList)) return [];

    const seen = new Set();
    const result = [];

    for (const item of skillList) {
      if (!item || typeof item !== 'string') continue;

      // Handle items that might be comma or pipe separated
      const parts = item.split(/[,|•/]/);
      for (const part of parts) {
        const canonical = this.normalizeSkill(part);
        if (canonical && !seen.has(canonical.toLowerCase())) {
          seen.add(canonical.toLowerCase());
          result.push(canonical);
        }
      }
    }

    return result;
  }

  /**
   * Categorizes a list of canonical skills into standard domains.
   * @param {string[]} skills 
   * @returns {Record<string, string[]>}
   */
  categorizeSkills(skills) {
    const categorized = {};
    const remaining = new Set(skills);

    for (const [category, catSkills] of Object.entries(CATEGORY_MAP)) {
      const matched = skills.filter(s => catSkills.some(cs => cs.toLowerCase() === s.toLowerCase()));
      if (matched.length > 0) {
        categorized[category] = matched;
        matched.forEach(s => remaining.delete(s));
      }
    }

    if (remaining.size > 0) {
      categorized['Other Skills'] = Array.from(remaining);
    }

    return categorized;
  }

  /**
   * Extracts skills from free-form text using the known taxonomy dictionary.
   * @param {string} text 
   * @returns {string[]}
   */
  extractSkillsFromText(text) {
    if (!text || typeof text !== 'string') return [];

    const foundSkills = new Set();

    // Check longer multi-word phrases first, then single words
    const aliases = Object.keys(ALIAS_MAP).sort((a, b) => b.length - a.length);

    for (const alias of aliases) {
      // Escape special characters in alias for regex (e.g. c++, c#, .net, socket.io)
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Word boundary regex: accommodate punctuation boundary for things like C++, C#, .NET
      const regex = new RegExp(`(?:^|[^a-zA-Z0-9#+.])${escaped}(?:$|[^a-zA-Z0-9#+.])`, 'i');

      if (regex.test(text)) {
        foundSkills.add(ALIAS_MAP[alias]);
      }
    }

    return Array.from(foundSkills);
  }
}

module.exports = new SkillTaxonomy();
