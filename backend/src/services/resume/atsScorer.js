/**
 * Transparent ATS Scorer & Job Description Matching Engine
 * Computes objective 0-100 ATS scores with granular breakdowns and factual alignment assessments.
 */

const skillTaxonomy = require('./skillTaxonomy');

class AtsScorer {
  /**
   * Computes an objective ATS score with transparent factor breakdown.
   * @param {Object} parsedData - Structured resume data
   * @param {string} rawText - Cleaned resume text
   * @returns {{ score: number, breakdown: Object, assessment: string, feedback: string[] }}
   */
  calculateAtsScore(parsedData, rawText = '') {
    const breakdown = {
      contact: 0,     // Max 10
      sections: 0,    // Max 15
      skills: 0,      // Max 20
      experience: 0,  // Max 20
      education: 0,   // Max 10
      projects: 0,    // Max 15
      formatting: 0   // Max 10
    };

    const feedback = [];

    // 1. Contact Info Completeness (Max 10)
    const { personalInfo = {} } = parsedData;
    if (personalInfo.email) breakdown.contact += 3;
    else feedback.push('Add a clear professional email address in the contact section.');

    if (personalInfo.phone) breakdown.contact += 3;
    else feedback.push('Include a contact phone number with country/area code.');

    if (personalInfo.location) breakdown.contact += 2;
    else feedback.push('Add your city and state/country location to help recruiters filter geographically.');

    if (personalInfo.linkedin || personalInfo.github || personalInfo.portfolio) {
      breakdown.contact += 2;
    } else {
      feedback.push('Include links to your LinkedIn profile, GitHub, or personal portfolio.');
    }

    // 2. Core Section Completeness (Max 15)
    let detectedSectionsCount = 0;
    if (parsedData.summary && parsedData.summary.length > 30) {
      breakdown.sections += 3;
      detectedSectionsCount++;
    }
    if (Array.isArray(parsedData.experience) && parsedData.experience.length > 0) {
      breakdown.sections += 3;
      detectedSectionsCount++;
    }
    if (Array.isArray(parsedData.education) && parsedData.education.length > 0) {
      breakdown.sections += 3;
      detectedSectionsCount++;
    }
    if (Array.isArray(parsedData.skills) && parsedData.skills.length > 0) {
      breakdown.sections += 3;
      detectedSectionsCount++;
    }
    if (Array.isArray(parsedData.projects) && parsedData.projects.length > 0) {
      breakdown.sections += 3;
      detectedSectionsCount++;
    } else if (Array.isArray(parsedData.experience) && parsedData.experience.length >= 2) {
      breakdown.sections += 3;
      detectedSectionsCount++;
    }

    // 3. Skills Depth & Taxonomy (Max 20)
    const skills = Array.isArray(parsedData.skills) ? parsedData.skills : [];
    if (skills.length >= 10) {
      breakdown.skills = 20;
    } else if (skills.length >= 7) {
      breakdown.skills = 16;
    } else if (skills.length >= 4) {
      breakdown.skills = 12;
    } else if (skills.length >= 1) {
      breakdown.skills = 7;
    } else {
      feedback.push('List core technical skills, frameworks, and tools in a dedicated Skills section.');
    }

    // 4. Experience & Practical Work (Max 20)
    const experience = Array.isArray(parsedData.experience) ? parsedData.experience : [];
    const projects = Array.isArray(parsedData.projects) ? parsedData.projects : [];

    if (experience.length > 0) {
      let expScore = 0;
      // Presence of role and company
      const hasRolesAndCompanies = experience.some(e => e.role && e.company);
      if (hasRolesAndCompanies) expScore += 8;

      // Bullet descriptions and details
      const hasDetailedBullets = experience.some(e => {
        const desc = Array.isArray(e.description) ? e.description.join(' ') : (e.description || '');
        return desc.length > 40;
      });
      if (hasDetailedBullets) expScore += 6;

      // Dates / tenure
      const hasDates = experience.some(e => e.duration || e.startDate);
      if (hasDates) expScore += 6;

      breakdown.experience = Math.min(20, expScore);
    } else if (projects.length >= 2) {
      // Student / Fresher credit: if no formal work experience, credit up to 14 points from extensive projects
      breakdown.experience = 14;
    } else {
      feedback.push('Include relevant work experience, internships, or open-source contributions.');
    }

    // 5. Education Completeness (Max 10)
    const education = Array.isArray(parsedData.education) ? parsedData.education : [];
    if (education.length > 0) {
      let eduScore = 0;
      if (education.some(e => e.degree)) eduScore += 4;
      if (education.some(e => e.institution || e.college || e.school)) eduScore += 3;
      if (education.some(e => e.year || e.graduationDate || e.cgpa || e.gpa || e.score)) eduScore += 3;
      breakdown.education = Math.min(10, eduScore);
    } else {
      feedback.push('Add an Education section detailing your degree, institution, and graduation timeline.');
    }

    // 6. Projects Section (Max 15)
    if (projects.length >= 3) {
      breakdown.projects = 15;
    } else if (projects.length === 2) {
      breakdown.projects = 12;
    } else if (projects.length === 1) {
      breakdown.projects = 8;
    } else if (experience.length >= 2) {
      // Experienced professional credit: industry experience delivers project engineering value
      breakdown.projects = 10;
    } else {
      feedback.push('Add personal or technical projects to demonstrate hands-on application of your skills.');
    }

    // 7. Structure & Formatting (Max 10)
    let formatScore = 0;
    if (detectedSectionsCount >= 4) formatScore += 4;
    if (rawText.includes('•') || rawText.includes('- ') || rawText.includes('* ')) formatScore += 3;
    // Check for metrics/quantifiable results in text (%, numbers, scale)
    if (/\b\d+%\b|\b\d+x\b|\b\d+\+\b/i.test(rawText)) {
      formatScore += 3;
    } else {
      feedback.push('Use quantifiable metrics (e.g. "improved performance by 30%", "built for 500+ users") to strengthen bullet points.');
    }
    breakdown.formatting = Math.min(10, formatScore);

    // Calculate total score
    const totalScore = Math.min(
      100,
      breakdown.contact +
      breakdown.sections +
      breakdown.skills +
      breakdown.experience +
      breakdown.education +
      breakdown.projects +
      breakdown.formatting
    );

    // Factual, objective assessment statement
    let assessment = '';
    if (totalScore >= 85) {
      assessment = 'Strong ATS alignment. The resume exhibits clear section hierarchy, robust technical skills, and well-structured entries.';
    } else if (totalScore >= 70) {
      assessment = 'Good ATS compatibility. The document features standard section headings and key skills, with opportunities to add further quantifiable metrics.';
    } else if (totalScore >= 50) {
      assessment = 'Moderate ATS compatibility. Expanding section detail, skill keywords, and project impact will improve parsing and relevance.';
    } else {
      assessment = 'Basic ATS compatibility. We recommend structuring the document with standard headings, adding full contact details, and expanding skill keywords.';
    }

    return {
      score: totalScore,
      breakdown,
      assessment,
      feedback: feedback.slice(0, 5)
    };
  }

  /**
   * Matches candidate resume against a target job description.
   * If no JD is provided, returns null with an informational notice.
   * @param {string[]} resumeSkills 
   * @param {string} resumeText 
   * @param {string} jobDescription 
   * @returns {Object|null}
   */
  matchJobDescription(resumeSkills = [], resumeText = '', jobDescription = '') {
    if (!jobDescription || typeof jobDescription !== 'string' || jobDescription.trim().length < 20) {
      return null;
    }

    // 1. Extract canonical skills from JD
    const jdSkills = skillTaxonomy.extractSkillsFromText(jobDescription);
    const resumeSkillsLower = new Set(resumeSkills.map(s => s.toLowerCase()));

    const matchedSkills = [];
    const missingSkills = [];

    for (const jdSkill of jdSkills) {
      if (resumeSkillsLower.has(jdSkill.toLowerCase()) || resumeText.toLowerCase().includes(jdSkill.toLowerCase())) {
        matchedSkills.push(jdSkill);
      } else {
        missingSkills.push(jdSkill);
      }
    }

    // Calculate match percentage based on required JD skills
    const totalJdSkills = jdSkills.length;
    let matchPercentage = 0;
    if (totalJdSkills > 0) {
      matchPercentage = Math.round((matchedSkills.length / totalJdSkills) * 100);
    } else {
      matchPercentage = 75; // Baseline if JD has non-standard skill keywords
    }

    const suggestions = [];
    if (missingSkills.length > 0) {
      suggestions.push(`Consider highlighting experience with key job requirements: ${missingSkills.slice(0, 5).join(', ')}.`);
    }
    if (matchPercentage >= 75) {
      suggestions.push('Strong keyword alignment with the target job description.');
    } else if (matchPercentage >= 50) {
      suggestions.push('Moderate keyword alignment. Incorporate missing requirements in your project descriptions or skills list.');
    } else {
      suggestions.push('Low keyword alignment. Tailor your resume summary and project bullets to mirror the role requirements.');
    }

    return {
      matchPercentage: Math.min(100, matchPercentage),
      matchedSkills,
      missingSkills,
      summary: `Found ${matchedSkills.length} of ${totalJdSkills} key skills mentioned in the job description (${matchPercentage}% match).`,
      suggestions
    };
  }
}

module.exports = new AtsScorer();
