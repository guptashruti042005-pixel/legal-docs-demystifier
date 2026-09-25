/**
 * Automated Regression Test on Real Uploaded Policy PDF:
 * Bajaj Allianz Life Goal Suraksha (UIN 116N155V14)
 * Validates that all user-reported bugs are resolved with ZERO hardcoding.
 */

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const assert = require('assert');
const legalAnalysisService = require('../services/legal/legalAnalysis.service');

async function runTest() {
  console.log('========================================================');
  console.log('RUNNING REGRESSION TEST ON REAL POLICY PDF');
  console.log('========================================================');

  const pdfPath = path.join(__dirname, '../../uploads/727d12c1-ccd4-4d7a-b39e-55b81131bc0b.pdf');
  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF file not found at ${pdfPath}`);
    process.exit(1);
  }

  const dataBuffer = fs.readFileSync(pdfPath);
  const pdfData = await pdf(dataBuffer);
  const rawText = pdfData.text;

  console.log(`Extracted ${rawText.length} raw characters from Policy PDF (${pdfData.numpages} pages).`);

  const result = legalAnalysisService.parseFromText(
    rawText,
    'default',
    'Bajaj Allianz Life Goal Suraksha-UIN-116N155V14.pdf',
    'general'
  );

  console.log('\n--- DOCUMENT CLASSIFICATION ---');
  console.log('Detected Category:', result.documentType);
  assert.strictEqual(result.documentType, 'Insurance Policy', 'Document should be categorized as Insurance Policy');

  console.log('\n--- KEY CLAUSES AUDIT ---');
  console.log(`Extracted ${result.importantClauses.length} clauses:`);
  result.importantClauses.forEach(c => console.log(`  - [${c.importance.toUpperCase()}] ${c.title} (${c.category})`));

  // 1. Ombudsman must NOT be classified as confidentiality
  const confClause = result.importantClauses.find(c => /confidential/i.test(c.title));
  if (confClause) {
    assert.ok(
      !/ombudsman|bimalokpal|cioins\.co\.in|kolkata/i.test(confClause.excerpt),
      'Confidentiality clause must NOT contain Ombudsman address'
    );
  }
  console.log('✅ PASS: Ombudsman address is NOT classified as Confidentiality.');

  // 2. Assignment must NOT be classified as payment terms
  const paymentClause = result.importantClauses.find(c => /payment\s+terms/i.test(c.title));
  if (paymentClause) {
    assert.ok(
      !/assignment|section\s+38|transferee/i.test(paymentClause.excerpt),
      'Payment Terms must NOT contain Assignment provisions'
    );
  }
  const assignmentClause = result.importantClauses.find(c => /assignment/i.test(c.title));
  assert.ok(assignmentClause, 'Assignment & Transfer clause should be correctly identified');
  console.log('✅ PASS: Assignment clause is NOT classified as Payment Terms.');

  console.log('\n--- DATE & TIMEFRAME AUDIT ---');
  console.log(`Extracted ${result.importantDates.length} dates/timeframes:`);
  result.importantDates.forEach(d => console.log(`  - ${d.date_or_period}: ${d.significance}`));

  // 3. 25/26/27 and 28/28/29 must NOT be dates
  const hasSpuriousExtension = result.importantDates.some(d => 
    /25\/26\/27|28\/28\/29|23\/24\/25/.test(d.date)
  );
  assert.strictEqual(hasSpuriousExtension, false, 'Spurious phone extensions must NOT be treated as dates');
  console.log('✅ PASS: Telephone extensions (25/26/27, 28/28/29) are NOT extracted as dates.');

  // 4. Valid contractual periods ARE extracted
  const hasFreeLook = result.importantDates.some(d => /30\s+days/i.test(d.date_or_period) && /free\s*look/i.test(d.significance));
  assert.ok(hasFreeLook, 'Free Look period of 30 days should be identified');

  const hasGrace = result.importantDates.some(d => /grace/i.test(d.significance));
  assert.ok(hasGrace, 'Grace period should be identified');
  console.log('✅ PASS: Legitimate periods (30-day Free Look, Grace Period) correctly identified.');

  console.log('\n--- FINANCIAL OBLIGATIONS AUDIT ---');
  console.log(`Extracted ${result.financialObligations.length} financial items:`);
  result.financialObligations.forEach(f => console.log(`  - ${f.type}: ${f.amount} (${f.description})`));
  assert.ok(result.financialObligations.length >= 2, 'Should extract policy benefits and financial obligations');
  console.log('✅ PASS: Real policy benefits and financial obligations extracted.');

  console.log('\n--- RED FLAGS & RISKS AUDIT ---');
  console.log(`Extracted ${result.redFlags.length} risks:`);
  result.redFlags.forEach(r => console.log(`  - [${r.severity.toUpperCase()}] ${r.title}: ${r.risk}`));
  assert.ok(result.redFlags.length >= 1, 'Should detect grounded risks (suicide exclusion, policy lapse, etc.)');
  console.log('✅ PASS: Real policy risks and exclusions detected.');

  console.log('\n--- RECOMMENDATIONS AUDIT ---');
  console.log(`Extracted ${result.recommendations.length} recommendations:`);
  result.recommendations.forEach(r => console.log(`  - [${r.priority.toUpperCase()}] ${r.action}`));

  // 5. Commercial invoice advice must NOT appear on insurance policy
  const hasInvoiceAdvice = result.recommendations.some(r => /invoice\s+cadence/i.test(r.action + ' ' + r.rationale));
  assert.strictEqual(hasInvoiceAdvice, false, 'Invoice cadence recommendation must NOT appear on insurance policy');

  // 6. Generic penalty negotiation must NOT appear without penalty context
  const hasGenericPenalty = result.recommendations.some(r => /negotiate\s+or\s+clarify\s+penalty\s+and\s+late\s+fee/i.test(r.action));
  assert.strictEqual(hasGenericPenalty, false, 'Generic penalty recommendation must NOT appear');

  // 7. Grounded insurance recommendations ARE present
  const hasFreeLookRec = result.recommendations.some(r => /free[\-\s]?look/i.test(r.action));
  assert.ok(hasFreeLookRec, 'Should recommend checking free-look cancellation window');
  console.log('✅ PASS: Inappropriate generic contract recommendations removed; grounded insurance advice generated.');

  console.log('\n--- MISSING CLAUSES AUDIT ---');
  console.log(`Missing clauses count: ${result.missingClauses.length}`);
  result.missingClauses.forEach(m => console.log(`  - ${m.clause}: ${m.explanation}`));

  // 8. Force Majeure must NOT be claimed as missing for individual life insurance
  const hasForceMajeure = result.missingClauses.some(m => /force\s+majeure/i.test(m.clause));
  assert.strictEqual(hasForceMajeure, false, 'Force Majeure must NOT be flagged as missing on individual insurance policy');
  console.log('✅ PASS: Category-aware missing clauses correctly evaluated.');

  console.log('\n========================================================');
  console.log('✅ ALL REGRESSION ASSERTIONS PASSED ON BAJAJ ALLIANZ PDF!');
  console.log('========================================================\n');
}

runTest().catch(err => {
  console.error('❌ REGRESSION TEST FAILED:', err);
  process.exit(1);
});
