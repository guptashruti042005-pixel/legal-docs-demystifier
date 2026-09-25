const assert = require('assert');
const path = require('path');
const fs = require('fs');

const resumeCleaner = require('../services/resume/resumeCleaner');
const sectionDetector = require('../services/resume/sectionDetector');
const skillTaxonomy = require('../services/resume/skillTaxonomy');
const contactExtractor = require('../services/resume/contactExtractor');
const atsScorer = require('../services/resume/atsScorer');
const resumeParser = require('../services/resume/resumeParser.service');

let passedTests = 0;
let totalTests = 0;

function runTest(testName, testFn) {
  totalTests++;
  try {
    testFn();
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${testName}`);
    console.error(err.message);
    if (err.stack) console.error(err.stack);
  }
}

console.log('========================================================');
console.log('STARTING RESUME PARSER AUTOMATED VERIFICATION SUITE');
console.log('========================================================\n');

// ----------------------------------------------------
// TEST 1: Student Resume (No work exp, Projects + Education)
// ----------------------------------------------------
runTest('TEST 1: Student Resume (Projects & Education, No Work Experience)', () => {
  const resumeText = `
Alex Mercer
alex.mercer@college.edu | +1-415-555-0199 | San Francisco, CA
linkedin.com/in/alexmercer | github.com/alexmercer

EDUCATION
Bachelor of Science in Computer Science
University of California, Berkeley
Graduation: May 2025 | GPA: 3.85 / 4.0

TECHNICAL SKILLS
Languages: Python, JavaScript, TypeScript, C++, SQL
Frameworks: React, Node.js, Express, Tailwind CSS
Databases & Cloud: PostgreSQL, MongoDB, Docker, Git

PROJECTS
Autonomous Drone Navigator | Python, OpenCV, ROS
https://github.com/alexmercer/drone-nav
• Developed autonomous path-planning algorithms using A* and Dijkstra.
• Integrated computer vision obstacle detection with 95% accuracy in indoor tests.
• Tested simulation environments across 50+ virtual flight hours.

Campus Marketplace App (React, Express, MongoDB)
• Built a peer-to-peer textbook marketplace serving 2,000+ university students.
• Implemented JWT authentication and real-time chat with Socket.io.
• Reduced API response latency by 35% using Redis caching.
`;

  const parsed = resumeParser.parseFromText(resumeText);

  assert.strictEqual(parsed.personalInfo.name, 'Alex Mercer', 'Candidate name should be extracted');
  assert.strictEqual(parsed.personalInfo.email, 'alex.mercer@college.edu', 'Email should match');
  assert.strictEqual(parsed.personalInfo.phone, '+1-415-555-0199', 'Phone should match');
  assert.ok(parsed.personalInfo.linkedin.includes('alexmercer'), 'LinkedIn extracted');
  assert.ok(parsed.personalInfo.github.includes('alexmercer'), 'GitHub extracted');

  // Education
  assert.ok(parsed.education.length >= 1, 'Education should be extracted');
  assert.ok(parsed.education[0].degree.includes('Computer Science') || parsed.education[0].degree.includes('Bachelor'), 'Degree detected');

  // Projects
  assert.ok(parsed.projects.length >= 2, 'Should extract at least 2 projects');
  assert.ok(parsed.projects.some(p => p.name.includes('Autonomous Drone')), 'Drone project detected');

  // Skills
  assert.ok(parsed.skills.includes('Python'), 'Python in skills');
  assert.ok(parsed.skills.includes('React'), 'React in skills');
  assert.ok(parsed.skills.includes('TypeScript'), 'TypeScript in skills');

  // ATS Score
  assert.ok(parsed.atsScore >= 70, `Student with strong projects should score >= 70, got ${parsed.atsScore}`);
  assert.ok(parsed.atsScoreBreakdown.projects >= 10, 'Projects breakdown score should be credited');
});

// ----------------------------------------------------
// TEST 2: Experienced Developer (Multiple Roles, Summary, Education)
// ----------------------------------------------------
runTest('TEST 2: Experienced Developer (Summary, 2+ Jobs, Canonical Skills)', () => {
  const resumeText = `
Elena Rostova
elena.rostova@techmail.com | +44 20 7946 0912 | London, UK
linkedin.com/in/elenarostova | github.com/erostova

PROFESSIONAL SUMMARY
Senior Backend Engineer with 6+ years of experience designing fault-tolerant microservices, high-throughput distributed systems, and cloud architectures.

WORK EXPERIENCE
Senior Software Engineer | FinTech Global | London, UK
January 2021 – Present
• Architected high-frequency transaction ledger handling over $50M in daily volume.
• Spearheaded migration from monolithic Java service to Go microservices on Kubernetes.
• Mentored a team of 7 junior and mid-level software engineers.

Backend Developer | DataStream Labs | London, UK
March 2018 – December 2020
• Developed asynchronous event-driven pipelines using Apache Kafka and PostgreSQL.
• Optimized complex SQL queries, cutting p99 database response times by 40%.

EDUCATION
Master of Science in Software Engineering
Imperial College London
2016 – 2018

TECHNICAL SKILLS
Go, Java, Python, Kubernetes, Docker, AWS, PostgreSQL, Kafka, Redis, Microservices, CI/CD, Git
`;

  const parsed = resumeParser.parseFromText(resumeText);

  assert.strictEqual(parsed.personalInfo.name, 'Elena Rostova', 'Name should be Elena Rostova');
  assert.strictEqual(parsed.personalInfo.email, 'elena.rostova@techmail.com', 'Email matches');
  assert.ok(parsed.summary.length > 30, 'Professional summary extracted');
  assert.strictEqual(parsed.experience.length, 2, 'Should extract exactly 2 work experience entries');
  assert.ok(parsed.experience[0].role.includes('Senior'), 'Senior role detected');
  assert.ok(parsed.experience[0].company.includes('FinTech'), 'FinTech company detected');
  assert.ok(parsed.skills.includes('Kubernetes'), 'Kubernetes in skills');
  assert.ok(parsed.skills.includes('PostgreSQL'), 'PostgreSQL in skills');
  assert.ok(parsed.atsScore >= 80, `Experienced developer should have high score >= 80, got ${parsed.atsScore}`);
  assert.ok(parsed.atsScoreBreakdown.experience >= 15, 'Experience score should be high');
});

// ----------------------------------------------------
// TEST 3: Non-Standard Section Headings
// ----------------------------------------------------
runTest('TEST 3: Non-Standard Section Headings (Career History, Core Competencies, Academic Background)', () => {
  const resumeText = `
David K. Vance
david.vance@workplace.org | 555-234-5678 | Austin, TX

CAREER PROFILE
Dynamic full-stack developer passionate about building accessible user interfaces.

CORE COMPETENCIES
JavaScript, React.js, HTML5, CSS3, TailwindCSS, Node.js, GraphQL, Git

CAREER HISTORY
Lead Web Developer | Vance Digital Solutions
2020 – 2023
• Built 15+ responsive client web applications with 100% lighthouse accessibility scores.

SELECTED PROJECTS
E-Commerce Portal (Next.js, Tailwind, Stripe)
• Full-stack e-commerce system with dynamic search and checkout.

ACADEMIC BACKGROUND
Bachelor of Arts in Digital Media
University of Texas at Austin | 2016 – 2020
`;

  const parsed = resumeParser.parseFromText(resumeText);

  assert.strictEqual(parsed.personalInfo.name, 'David K. Vance', 'Name detected');
  assert.ok(parsed.skills.includes('React'), 'React normalized from React.js');
  assert.ok(parsed.skills.includes('Tailwind CSS'), 'Tailwind CSS normalized from TailwindCSS');
  assert.ok(parsed.experience.length >= 1, 'Career History mapped to Experience');
  assert.ok(parsed.projects.length >= 1, 'Selected Projects mapped to Projects');
  assert.ok(parsed.education.length >= 1, 'Academic Background mapped to Education');
});

// ----------------------------------------------------
// TEST 4: Minimal Resume
// ----------------------------------------------------
runTest('TEST 4: Minimal Resume (Name, Email, Skills, Education Only)', () => {
  const resumeText = `
Jordan Lee
jordan.lee@example.com

SKILLS
Python, JavaScript, Git, SQL

EDUCATION
Associate Degree in Computer Technology
Austin Community College | 2023
`;

  const parsed = resumeParser.parseFromText(resumeText);

  assert.strictEqual(parsed.personalInfo.name, 'Jordan Lee', 'Name detected');
  assert.strictEqual(parsed.personalInfo.email, 'jordan.lee@example.com', 'Email detected');
  assert.ok(parsed.skills.length >= 3, 'Extracted skills');
  assert.ok(parsed.education.length >= 1, 'Education detected');
  assert.ok(parsed.atsScore < 70, `Minimal resume should receive moderate/basic score, got ${parsed.atsScore}`);
  assert.ok(parsed.resumeFeedback.improvements.length > 0, 'Feedback should offer concrete improvement tips');
});

// ----------------------------------------------------
// TEST 5: Unusual Section Ordering (Projects first, then Education, Experience, Certifications)
// ----------------------------------------------------
runTest('TEST 5: Unusual Section Ordering (Projects before Experience)', () => {
  const resumeText = `
Maya Lin
maya.lin@domain.com | (212) 555-7890 | New York, NY

PROJECTS
Smart Health Tracker | React Native, Firebase
• Mobile app tracking patient metrics with Bluetooth sync.

EDUCATION
B.S. in Biomedical Informatics | Columbia University | 2022

WORK EXPERIENCE
Research Assistant | Mount Sinai Health System
2022 – 2023
• Processed anonymized clinical health records using Python and Pandas.

TECHNICAL SKILLS
React Native, Python, Pandas, Firebase, Git

CERTIFICATIONS
AWS Certified Cloud Practitioner - Amazon Web Services - 2023
`;

  const parsed = resumeParser.parseFromText(resumeText);

  assert.strictEqual(parsed.personalInfo.name, 'Maya Lin', 'Name detected');
  assert.ok(parsed.projects.length >= 1, 'Projects extracted despite order');
  assert.ok(parsed.education.length >= 1, 'Education extracted despite order');
  assert.ok(parsed.experience.length >= 1, 'Experience extracted despite order');
  assert.ok(parsed.certifications.length >= 1, 'Certifications extracted');
  assert.ok(parsed.certifications[0].name.includes('AWS Certified'), 'AWS certification parsed');
});

// ----------------------------------------------------
// TEST 6: Multi-Page with Repeated Artifacts & [Page 1]: Markers
// ----------------------------------------------------
runTest('TEST 6: Multi-Page with Extraction Markers & Repeated Page Headers', () => {
  const messyText = `[Page 1]:
Sarah Jenkins
sarah.j@enterprise.com | +1 555 432 1098 | Seattle, WA
Page 1 of 2

PROFESSIONAL EXPERIENCE
Software Architect | CloudScale Systems
2021 – Present
• Designed microservices handling high concurrency with Docker and Kubernetes.

[Page 2]:
Sarah Jenkins
Page 2 of 2
Software Architect | CloudScale Systems

EDUCATION
Bachelor of Science in Computer Engineering | University of Washington | 2015

SKILLS
Docker, Kubernetes, Go, AWS, Python, Redis
`;

  const cleaned = resumeCleaner.clean(messyText);
  assert.ok(!cleaned.includes('[Page 1]:'), 'Page markers removed');
  assert.ok(!cleaned.includes('[Page 2]:'), 'Page markers removed');
  assert.ok(!cleaned.includes('Page 1 of 2'), 'Page pagination removed');

  const parsed = resumeParser.parseFromText(messyText);
  assert.strictEqual(parsed.personalInfo.name, 'Sarah Jenkins', 'Name must not contain [Page 1]:');
  assert.ok(parsed.experience.length >= 1, 'Experience extracted');
  assert.ok(parsed.education.length >= 1, 'Education extracted');
});

// ----------------------------------------------------
// TEST 7: Technology vs Website Classification & Email Domain Guardrail
// ----------------------------------------------------
runTest('TEST 7: Guardrail - Tech names and email domains must NOT be classified as websites', () => {
  const textWithTech = `
Rohan Deshmukh
rohan.dev@gmail.com | +91 9876543210 | Pune, Maharashtra
linkedin.com/in/rohandesh | github.com/rohandesh

TECHNICAL SKILLS
Frontend: React.js, Next.js, Vue.js
Backend: Node.js, Express.js, Socket.io
Database: MySQL, PostgreSQL, MongoDB

PROJECTS
Real-Time Chat App | Node.js, Socket.io, React.js
• Created chat with Socket.io real-time streaming and MySQL persistence.
`;

  const contacts = contactExtractor.extractAll(textWithTech);

  // Assertions:
  assert.strictEqual(contacts.email, 'rohan.dev@gmail.com', 'Email matched');
  assert.ok(contacts.linkedin.includes('rohandesh'), 'LinkedIn matched');
  assert.ok(contacts.github.includes('rohandesh'), 'GitHub matched');

  // CRITICAL: Neither portfolio nor otherLinks should contain Socket.io, Node.js, Express.js, React.js, MySQL, or gmail.com
  const allUrls = [contacts.portfolio, ...(contacts.otherLinks || [])].filter(Boolean);

  for (const url of allUrls) {
    const lower = url.toLowerCase();
    assert.ok(!lower.includes('socket.io'), 'Socket.io must NOT be classified as a website URL');
    assert.ok(!lower.includes('node.js'), 'Node.js must NOT be classified as a website URL');
    assert.ok(!lower.includes('express.js'), 'Express.js must NOT be classified as a website URL');
    assert.ok(!lower.includes('react.js'), 'React.js must NOT be classified as a website URL');
    assert.ok(!lower.includes('mysql'), 'MySQL must NOT be classified as a website URL');
    assert.ok(!lower.includes('gmail.com'), 'gmail.com must NOT be classified as a website URL');
  }

  // Canonical skill verification
  const parsed = resumeParser.parseFromText(textWithTech);
  assert.ok(parsed.skills.includes('Socket.io'), 'Socket.io preserved as skill');
  assert.ok(parsed.skills.includes('Node.js'), 'Node.js preserved as skill');
  assert.ok(parsed.skills.includes('Express.js'), 'Express.js preserved as skill');
  assert.ok(parsed.skills.includes('React'), 'React.js normalized to React');
  assert.ok(parsed.skills.includes('MySQL'), 'MySQL preserved as skill');
});

// ----------------------------------------------------
// TEST 8: Target Job Description Matching
// ----------------------------------------------------
runTest('TEST 8: Job Description Matching (With JD vs Without JD)', () => {
  const resume = `
Jane Doe
jane@example.com | 555-111-2222
SKILLS: Python, Docker, Kubernetes, AWS, PostgreSQL
EXPERIENCE: Backend Engineer | CloudCo | 2021-2024
EDUCATION: BS in CS | State Univ | 2021
`;

  // Without JD
  const parsedWithoutJd = resumeParser.parseFromText(resume, '');
  assert.strictEqual(parsedWithoutJd.jobDescriptionMatch, null, 'jobDescriptionMatch must be null when no JD is provided');

  // With JD
  const targetJd = `
Looking for a Senior Backend Engineer.
Must have strong experience with Python, Kubernetes, Go, Terraform, and GraphQL.
`;
  const parsedWithJd = resumeParser.parseFromText(resume, targetJd);
  assert.ok(parsedWithJd.jobDescriptionMatch !== null, 'jobDescriptionMatch must exist when JD is provided');
  assert.ok(parsedWithJd.jobDescriptionMatch.matchedSkills.includes('Python'), 'Python matched');
  assert.ok(parsedWithJd.jobDescriptionMatch.matchedSkills.includes('Kubernetes'), 'Kubernetes matched');
  assert.ok(parsedWithJd.jobDescriptionMatch.missingSkills.includes('Go') || parsedWithJd.jobDescriptionMatch.missingSkills.includes('Terraform'), 'Missing skills identified');
});

console.log(`\n========================================================`);
console.log(`TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log(`========================================================`);

if (passedTests !== totalTests) {
  process.exit(1);
}
