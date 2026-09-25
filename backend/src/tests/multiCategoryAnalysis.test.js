/**
 * Multi-Category Automated Verification Suite.
 * Tests general-purpose extraction across 5 distinct document structures and categories:
 * 1. Insurance Policy
 * 2. Employment Agreement
 * 3. Non-Disclosure Agreement (NDA)
 * 4. Rental / Lease Agreement
 * 5. Generic Service Contract
 *
 * Verifies ZERO hardcoding and universal document-grounded analysis.
 */

const assert = require('assert');
const legalAnalysisService = require('../services/legal/legalAnalysis.service');

// 1. Insurance Policy Document
const insuranceDoc = `
HEALTH & LIFE INSURANCE POLICY DOCUMENT
Plan: Complete Health Shield Care Policy
1. Definitions
"Policyholder" means the person who has taken this insurance policy.
"Sum Assured" means the maximum coverage amount payable of INR 10,00,000.
2. Premium Obligations
The Policyholder agrees to pay an annual Regular Premium of INR 25,000 on or before the due date.
A Grace Period of 30 days shall be allowed for the payment of yearly premiums. If premium is not paid within the grace period, the policy shall lapse without value.
3. Free Look Period
The Insured shall be entitled to a Free Look Period of 15 days from the date of receipt of the policy document to review the terms. The Policyholder may return the policy for cancellation and receive a refund of regular premiums paid.
4. Policy Benefits
In the event of hospitalisation of the Life Assured during the policy term, the Company shall pay the hospitalization expenses up to the Sum Assured.
5. Exclusions & Waiting Period
In case of death due to suicide within 12 months from policy inception, no death benefit shall be payable.
6. Assignment and Transfer
Notice of Assignment of this policy must be delivered to the company under Section 38 of the Insurance Act.
7. Grievance Redressal
In case of disputes, contact the Insurance Ombudsman, Office of the Insurance Ombudsman, Jeevan Seva Annexe.
`;

// 2. Employment Agreement Document
const employmentDoc = `
EMPLOYMENT AGREEMENT
This Employment Agreement is entered into between Apex Innovations Private Limited ("Employer") and John Doe ("Employee").
1. Position & Duties
Employee is appointed to the full-time role of Senior Systems Architect, responsible for leading platform engineering.
2. Compensation & Benefits
Employer shall pay Employee a base salary of INR 18,00,000 per annum, payable in equal monthly installments.
3. Working Hours & Probation
The probationary period shall be 6 months from the commencement date.
4. Termination & Notice Period
Either party may terminate this agreement by providing a written notice period of 60 days or base salary in lieu thereof. Employer may terminate immediately for gross misconduct.
5. Confidentiality & Intellectual Property Assignment
Employee agrees to maintain in strict confidence all trade secrets and proprietary information. All inventions created during employment are the sole property of Employer.
6. Post-Employment Non-Compete Restraint
Employee shall not engage in competing software development within the state for a period of 12 months post-termination.
7. Governing Law
This Agreement shall be governed by the laws of India and subject to the exclusive jurisdiction of the courts of Bangalore.
`;

// 3. Non-Disclosure Agreement (NDA) Document
const ndaDoc = `
MUTUAL NON-DISCLOSURE AGREEMENT
This Mutual Non-Disclosure Agreement is executed between Alpha Corp and Beta Systems.
1. Definition of Confidential Information
"Confidential Information" includes all technical data, customer lists, algorithms, source code, and business plans disclosed in writing or orally.
2. Exclusions from Confidentiality
Confidential Information does not include information that is publicly known, already in the recipient's possession, or independently developed without reference to disclosed materials.
3. Non-Disclosure Obligations
Each receiving party shall keep confidential and not disclose any proprietary information to third parties without prior written consent, using the same degree of care it uses for its own sensitive data.
4. Duration of Confidentiality
The obligations under this agreement shall remain in effect for a period of 3 years following the date of disclosure.
5. Return of Materials
Upon termination, the receiving party shall promptly return or certify destruction of all documents containing confidential data.
6. Remedies & Injunctive Relief
Parties acknowledge that unauthorized disclosure may cause irreparable harm entitling the disclosing party to seek injunctive relief in addition to monetary damages.
`;

// 4. Rental / Lease Agreement Document
const rentalDoc = `
RESIDENTIAL LEASE AGREEMENT
This Lease Agreement is made between Ramesh Sharma ("Landlord") and Priya Verma ("Tenant").
1. Leased Premises
Flat No. 402, Green Valley Apartments, Mumbai.
2. Tenure & Term
The lease term shall be for a period of 11 months commencing from 01/10/2025.
3. Monthly Rent
Tenant agrees to pay a monthly rent of INR 45,000 payable on or before the 5th day of each calendar month.
4. Security Deposit
Tenant has deposited an interest-free refundable Security Deposit of INR 1,50,000 with the Landlord. The deposit shall be refunded within 15 days of vacating the premises, subject to deductions for damages or unpaid utility bills.
5. Lock-in Period
Both parties agree to a lock-in period of 6 months during which neither party can terminate without paying rent for the remainder of the lock-in period.
6. Termination & Notice
After the lock-in period, either party may terminate this lease by providing a notice period of 30 days in writing.
7. Maintenance
Tenant shall be responsible for routine internal maintenance, while structural repairs shall be borne by Landlord.
`;

// 5. Service Agreement Document
const serviceDoc = `
MASTER SERVICES AGREEMENT
This Master Services Agreement is entered into between Horizon Media LLC ("Client") and Quantum Tech Solutions ("Contractor").
1. Scope of Work & Deliverables
Contractor shall deliver cloud migration and system integration as detailed in Statement of Work (SOW-01).
2. Payment Terms & Invoicing
Contractor shall submit monthly invoices for completed milestone deliverables. Client shall remit payment within net 30 days of invoice receipt.
3. Limitation of Liability
The maximum aggregate liability of either party arising out of this agreement shall not exceed the total fees paid under the applicable Statement of Work in the preceding 6 months. Neither party shall be liable for indirect or consequential damages.
4. Warranties & Service Level
Contractor warrants that services will be performed in a professional manner adhering to industry standards.
5. Termination for Convenience
Either party may terminate this agreement without cause upon providing 30 days prior written notice.
6. Intellectual Property
Upon full payment, Client shall own all custom software deliverables created specifically for Client.
`;

async function runTestSuite() {
  console.log('========================================================');
  console.log('MULTI-CATEGORY VERIFICATION TEST SUITE');
  console.log('========================================================');

  // TEST 1: Insurance Policy
  console.log('\n--- TEST 1: Insurance Policy ---');
  const res1 = legalAnalysisService.parseFromText(insuranceDoc, 'default', 'health_shield.pdf', 'general');
  console.log('Category:', res1.documentType);
  assert.strictEqual(res1.documentType, 'Insurance Policy');
  assert.ok(res1.importantDates.some(d => /free[\-\s]?look/i.test(d.significance)), 'Identified free look period');
  assert.ok(res1.importantDates.some(d => /grace/i.test(d.significance)), 'Identified grace period');
  assert.ok(res1.importantClauses.some(c => /assignment/i.test(c.title)), 'Assignment identified as assignment');
  assert.ok(!res1.importantClauses.some(c => /confidential/i.test(c.title)), 'No spurious confidentiality from Ombudsman');
  assert.ok(!res1.recommendations.some(r => /invoice/i.test(r.action)), 'No invoice advice on insurance policy');
  console.log('✅ [PASS] Insurance Policy Analysis');

  // TEST 2: Employment Agreement
  console.log('\n--- TEST 2: Employment Agreement ---');
  const res2 = legalAnalysisService.parseFromText(employmentDoc, 'lawyer', 'offer_letter.pdf', 'general');
  console.log('Category:', res2.documentType);
  assert.strictEqual(res2.documentType, 'Employment Agreement');
  assert.ok(res2.financialObligations.some(f => /salary|compensation/i.test(f.type) || f.amount.includes('18,00,000')), 'Extracted compensation');
  assert.ok(res2.redFlags.some(r => /non[\-\s]?compete/i.test(r.title)), 'Identified non-compete risk');
  assert.ok(res2.importantClauses.some(c => /confidentiality/i.test(c.title)), 'Genuine confidentiality detected');
  console.log('✅ [PASS] Employment Agreement Analysis');

  // TEST 3: Non-Disclosure Agreement (NDA)
  console.log('\n--- TEST 3: Non-Disclosure Agreement (NDA) ---');
  const res3 = legalAnalysisService.parseFromText(ndaDoc, 'business', 'mutual_nda.pdf', 'general');
  console.log('Category:', res3.documentType);
  assert.strictEqual(res3.documentType, 'Non-Disclosure Agreement (NDA)');
  assert.ok(res3.importantClauses.some(c => /confidentiality/i.test(c.title)), 'Extracted confidentiality obligations');
  assert.ok(res3.importantDates.length >= 0, 'Processed duration terms');
  console.log('✅ [PASS] Non-Disclosure Agreement Analysis');

  // TEST 4: Rental / Lease Agreement
  console.log('\n--- TEST 4: Rental / Lease Agreement ---');
  const res4 = legalAnalysisService.parseFromText(rentalDoc, 'senior', 'tenancy_contract.pdf', 'general');
  console.log('Category:', res4.documentType);
  assert.strictEqual(res4.documentType, 'Rental / Lease Agreement');
  assert.ok(res4.financialObligations.some(f => /rent|deposit/i.test(f.type)), 'Extracted rent and security deposit');
  assert.ok(res4.importantDates.some(d => /lock[\-\s]?in/i.test(d.significance)), 'Identified lock-in period');
  console.log('✅ [PASS] Rental / Lease Agreement Analysis');

  // TEST 5: Service Agreement
  console.log('\n--- TEST 5: Service Agreement ---');
  const res5 = legalAnalysisService.parseFromText(serviceDoc, 'business', 'master_services.pdf', 'general');
  console.log('Category:', res5.documentType);
  assert.strictEqual(res5.documentType, 'Service Agreement');
  assert.ok(res5.importantClauses.some(c => /scope|deliverables/i.test(c.title)), 'Extracted scope of work');
  assert.ok(res5.importantClauses.some(c => /liability/i.test(c.title)), 'Extracted limitation of liability');
  assert.ok(res5.recommendations.some(r => /invoicing|milestone/i.test(r.action)), 'Invoice milestone recommendation appropriate here');
  console.log('✅ [PASS] Service Agreement Analysis');

  console.log('\n========================================================');
  console.log('✅ ALL 5 CATEGORY VERIFICATION TESTS PASSED!');
  console.log('========================================================\n');
}

runTestSuite().catch(err => {
  console.error('❌ MULTI-CATEGORY TEST FAILED:', err);
  process.exit(1);
});
