const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const resumeParser = require('../services/resume/resumeParser.service');
const resumeCleaner = require('../services/resume/resumeCleaner');

async function testPdfRegression() {
  console.log('========================================================');
  console.log('RUNNING REGRESSION TEST ON TEST RESUME PDF');
  console.log('========================================================\n');

  const pdfPath = path.resolve(__dirname, '../../uploads/167682ca-0890-4b56-808c-5546d6204d02.pdf');
  if (!fs.existsSync(pdfPath)) {
    console.warn(`PDF file not found at ${pdfPath}. Skipping file-based test.`);
    return;
  }

  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer);
  const rawText = data.text;

  console.log(`Extracted ${rawText.length} raw characters from PDF.`);

  const parsed = resumeParser.parseFromText(rawText);

  console.log('--- PARSED CANDIDATE CONTACT INFO ---');
  console.log('Name:', parsed.personalInfo.name);
  console.log('Email:', parsed.personalInfo.email);
  console.log('Phone:', parsed.personalInfo.phone);
  console.log('Location:', parsed.personalInfo.location);
  console.log('LinkedIn:', parsed.personalInfo.linkedin);
  console.log('GitHub:', parsed.personalInfo.github);
  console.log('Portfolio:', parsed.personalInfo.portfolio);
  console.log('Other Links:', parsed.personalInfo.otherLinks);

  console.log('\n--- EXTRACTED SKILLS ---');
  console.log(`Found ${parsed.skills.length} skills:`, parsed.skills.slice(0, 15).join(', '));

  console.log('\n--- EXTRACTED PROJECTS ---');
  console.log(`Found ${parsed.projects.length} projects:`);
  parsed.projects.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} (Tech: ${p.technologies?.join(', ') || 'N/A'})`));

  console.log('\n--- EXTRACTED EXPERIENCE ---');
  console.log(`Found ${parsed.experience.length} experience entries:`);
  parsed.experience.forEach((e, i) => console.log(`  ${i + 1}. ${e.role} at ${e.company} (${e.duration})`));

  console.log('\n--- EXTRACTED EDUCATION ---');
  console.log(`Found ${parsed.education.length} education entries:`);
  parsed.education.forEach((edu, i) => console.log(`  ${i + 1}. ${edu.degree} - ${edu.institution} (${edu.score || edu.year})`));

  console.log('\n--- ATS SCORING ---');
  console.log('Score:', parsed.atsScore);
  console.log('Breakdown:', parsed.atsScoreBreakdown);
  console.log('Assessment:', parsed.atsAssessment);

  // Assertions to verify generalization and correctness:
  // 1. Name must NOT have [Page 1]: prefix
  if (parsed.personalInfo.name.includes('[Page 1]')) {
    throw new Error('Name contains page marker prefix!');
  }

  // 2. Email must be valid
  if (!parsed.personalInfo.email.includes('@')) {
    throw new Error('Valid email was not extracted!');
  }

  // 3. Projects must be parsed (at least 2)
  if (parsed.projects.length < 2) {
    throw new Error(`Expected at least 2 projects, got ${parsed.projects.length}`);
  }

  // 4. Skills must be extracted
  if (parsed.skills.length < 8) {
    throw new Error(`Expected at least 8 skills, got ${parsed.skills.length}`);
  }

  // 5. Technologies must NOT be in portfolio or links
  const allUrls = [parsed.personalInfo.portfolio, ...(parsed.personalInfo.otherLinks || [])].filter(Boolean);
  for (const u of allUrls) {
    if (/socket\.io|node\.js|express\.js|react\.js|mysql|gmail\.com/i.test(u)) {
      throw new Error(`Forbidden technology/email domain classified as website: ${u}`);
    }
  }

  // 6. ATS Score must be calculated with breakdown
  if (!parsed.atsScore || !parsed.atsScoreBreakdown) {
    throw new Error('ATS Score or breakdown missing!');
  }

  console.log('\n✅ ALL REGRESSION ASSERTIONS PASSED ON REAL PDF!');
}

testPdfRegression().catch(err => {
  console.error('\n❌ REGRESSION TEST FAILED:', err.message);
  process.exit(1);
});
