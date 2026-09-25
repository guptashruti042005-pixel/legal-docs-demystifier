/**
 * Document Classifier & Category Schema Provider.
 * Automatically identifies document category and provides category-specific
 * expected concepts, safeguards, and clause taxonomies.
 * ZERO company-specific or product-specific hardcoding.
 */

class DocumentClassifier {
  constructor() {
    this.categoryProfiles = {
      'Insurance Policy': {
        displayName: 'Insurance Policy',
        description: 'Insurance contract governing risk coverage, premiums, benefits, and claims.',
        keywords: [
          /\binsurance\b/i, /\bpolicyholder\b/i, /\blife\s+assured\b/i, /\bsum\s+assured\b/i,
          /\bpremium\b/i, /\bfree[\-\s]?look\b/i, /\bgrace\s+period\b/i, /\bsurrender\s+value\b/i,
          /\bdeath\s+benefit\b/i, /\bmaturity\s+benefit\b/i, /\bnomination\b/i, /\bassignment\b/i,
          /\blapse\b/i, /\brevival\b/i, /\bombudsman\b/i, /\birda(?:i)?\b/i, /\binsured\b/i
        ],
        expectedClauses: [
          { name: 'Free Look Period', importance: 'high', explanation: 'Statutory cooling-off period allowing full refund upon cancellation.' },
          { name: 'Grace Period & Lapse', importance: 'high', explanation: 'Window to remit overdue premiums before policy lapse or paid-up status.' },
          { name: 'Policy Benefits', importance: 'high', explanation: 'Defines death, maturity, or survival payouts.' },
          { name: 'Exclusions & Waiting Period', importance: 'high', explanation: 'Conditions under which claims will be denied or delayed.' },
          { name: 'Surrender & Paid-up Provisions', importance: 'medium', explanation: 'Rules and deductions applying if policy is discontinued early.' },
          { name: 'Grievance Redressal / Ombudsman', importance: 'medium', explanation: 'Formal escalation mechanism for complaints and dispute resolution.' },
          { name: 'Nomination & Assignment', importance: 'medium', explanation: 'Rights to designate beneficiaries or transfer policy rights.' }
        ]
      },
      'Employment Agreement': {
        displayName: 'Employment Agreement',
        description: 'Agreement establishing terms of employment, compensation, and duties.',
        keywords: [
          /\bemployment\b/i, /\bemployer\b/i, /\bemployee\b/i, /\bsalary\b/i,
          /\bcompensation\b/i, /\bprobation\b/i, /\bjob\s+title\b/i, /\bworking\s+hours\b/i,
          /\bseverance\b/i, /\bnon[\-\s]?compete\b/i, /\bnon[\-\s]?solicitation\b/i, /\boffer\s+letter\b/i
        ],
        expectedClauses: [
          { name: 'Roles & Responsibilities', importance: 'high', explanation: 'Scope of employment duties and reporting structure.' },
          { name: 'Compensation & Benefits', importance: 'high', explanation: 'Salary, bonuses, benefits, and payment frequency.' },
          { name: 'Notice Period & Termination', importance: 'high', explanation: 'Required notice and separation protocols for ending employment.' },
          { name: 'Confidentiality & IP Assignment', importance: 'high', explanation: 'Ownership of work output and protection of employer data.' },
          { name: 'Post-Employment Restraints', importance: 'medium', explanation: 'Scope and duration of non-compete or non-solicitation clauses.' },
          { name: 'Dispute Resolution', importance: 'medium', explanation: 'Jurisdiction or arbitration mechanisms for employment disputes.' }
        ]
      },
      'Rental / Lease Agreement': {
        displayName: 'Rental / Lease Agreement',
        description: 'Lease or tenancy contract governing property occupancy and rent.',
        keywords: [
          /\blandlord\b/i, /\btenant\b/i, /\blessor\b/i, /\blessee\b/i, /\blease\b/i,
          /\btenancy\b/i, /\brent\b/i, /\bsecurity\s+deposit\b/i, /\bpremises\b/i,
          /\block[\-\s]?in\s+period\b/i, /\bevict(?:ion)?\b/i, /\bsub[\-\s]?let(?:ting)?\b/i
        ],
        expectedClauses: [
          { name: 'Rent & Due Date', importance: 'high', explanation: 'Monthly rent amount, due date, and payment mechanism.' },
          { name: 'Security Deposit & Refund', importance: 'high', explanation: 'Deposit amount, allowable deductions, and refund timelines.' },
          { name: 'Tenure & Lock-in Period', importance: 'high', explanation: 'Lease term and any non-negotiable minimum occupancy period.' },
          { name: 'Maintenance & Repairs', importance: 'medium', explanation: 'Allocation of responsibility for regular maintenance vs structural repairs.' },
          { name: 'Termination & Eviction Notice', importance: 'high', explanation: 'Notice period required for tenant vacating or landlord repossession.' },
          { name: 'Permitted Use & Subletting', importance: 'medium', explanation: 'Restrictions on commercial use or unauthorized occupants.' }
        ]
      },
      'Non-Disclosure Agreement (NDA)': {
        displayName: 'Non-Disclosure Agreement (NDA)',
        description: 'Confidentiality contract governing proprietary information protection.',
        keywords: [
          /\bnon[\-\s]?disclosure\b/i, /\bconfidential\s+information\b/i, /\bdisclosing\s+party\b/i,
          /\breceiving\s+party\b/i, /\bproprietary\s+information\b/i, /\btrade\s+secrets\b/i,
          /\bmutual\s+nda\b/i, /\bconfidentiality\s+agreement\b/i
        ],
        expectedClauses: [
          { name: 'Definition of Confidential Information', importance: 'high', explanation: 'What types of data and materials are protected.' },
          { name: 'Exclusions from Confidentiality', importance: 'high', explanation: 'Standard carve-outs for public knowledge or independently developed data.' },
          { name: 'Standard of Care & Protection', importance: 'high', explanation: 'Level of reasonable security required to safeguard data.' },
          { name: 'Duration of Confidentiality', importance: 'high', explanation: 'Length of time the non-disclosure obligation remains in effect.' },
          { name: 'Return or Destruction of Materials', importance: 'medium', explanation: 'Requirement to return or certify deletion upon termination.' },
          { name: 'Remedies & Injunctive Relief', importance: 'medium', explanation: 'Right to seek emergency court injunctions for breaches.' }
        ]
      },
      'Service Agreement': {
        displayName: 'Service Agreement',
        description: 'Commercial contract defining service delivery, milestones, and fees.',
        keywords: [
          /\bservice\s+agreement\b/i, /\bstatement\s+of\s+work\b/i, /\bscope\s+of\s+work\b/i,
          /\bdeliverables\b/i, /\bclient\b/i, /\bcontractor\b/i, /\bsla\b/i, /\bservice\s+level\b/i,
          /\bmaster\s+services\s+agreement\b/i, /\binvoice\b/i, /\bmilestone\b/i
        ],
        expectedClauses: [
          { name: 'Scope of Work & Deliverables', importance: 'high', explanation: 'Clear specification of services, milestones, and outputs.' },
          { name: 'Payment Terms & Invoicing', importance: 'high', explanation: 'Invoicing schedule, milestone payments, and acceptance criteria.' },
          { name: 'Service Level & Warranties', importance: 'medium', explanation: 'Service performance standards and defect remediation obligations.' },
          { name: 'Limitation of Liability', importance: 'high', explanation: 'Financial cap on aggregate damages for breaches.' },
          { name: 'Termination for Convenience & Cause', importance: 'high', explanation: 'Procedures to end the engagement with or without default.' },
          { name: 'Intellectual Property Ownership', importance: 'high', explanation: 'Whether client owns deliverables and vendor retains background IP.' }
        ]
      },
      'Loan / Credit Agreement': {
        displayName: 'Loan / Credit Agreement',
        description: 'Financing contract detailing principal, interest, and repayment terms.',
        keywords: [
          /\bloan\b/i, /\bborrower\b/i, /\blender\b/i, /\bprincipal\s+amount\b/i,
          /\binterest\s+rate\b/i, /\brepayment\b/i, /\bemi\b/i, /\bcollateral\b/i,
          /\bdefault\b/i, /\bpromissory\s+note\b/i, /\bmortgage\b/i, /\bforeclosure\b/i
        ],
        expectedClauses: [
          { name: 'Principal & Interest Rate', importance: 'high', explanation: 'Total borrowed sum and applicable interest rate (fixed/floating).' },
          { name: 'Repayment Schedule & Tenure', importance: 'high', explanation: 'EMI amount, due dates, and duration of loan.' },
          { name: 'Prepayment & Foreclosure Charges', importance: 'medium', explanation: 'Penalties or fees for paying off the loan ahead of schedule.' },
          { name: 'Events of Default', importance: 'high', explanation: 'Triggers that allow lender to demand immediate repayment.' },
          { name: 'Collateral & Security', importance: 'high', explanation: 'Pledged assets that can be seized or auctioned in default.' }
        ]
      }
    };
  }

  /**
   * Automatically detect the document category
   * @param {string} text - Cleaned document text
   * @param {string} fileName - Uploaded file name
   * @param {string} userSelectedType - Optional user selection
   * @returns {string} Detected category name
   */
  detectCategory(text, fileName = '', userSelectedType = '') {
    if (userSelectedType && userSelectedType !== 'general' && userSelectedType !== 'default') {
      const match = Object.keys(this.categoryProfiles).find(k => k.toLowerCase() === userSelectedType.toLowerCase());
      if (match) return match;
    }

    const sample = ((fileName || '') + ' ' + (text || '').slice(0, 5000)).toLowerCase();

    // Check title / heading specifically first
    const firstLines = (text || '').slice(0, 1000).toLowerCase();
    if (/life\s+insurance|general\s+insurance|health\s+insurance|policy\s+document|savings\s+plan|endowment\s+plan/i.test(firstLines)) {
      return 'Insurance Policy';
    }
    if (/non[\-\s]?disclosure\s+agreement|confidentiality\s+agreement|mutual\s+nda/i.test(firstLines)) {
      return 'Non-Disclosure Agreement (NDA)';
    }
    if (/lease\s+agreement|rental\s+agreement|tenancy\s+agreement/i.test(firstLines)) {
      return 'Rental / Lease Agreement';
    }
    if (/employment\s+agreement|employment\s+contract|appointment\s+letter|offer\s+letter/i.test(firstLines)) {
      return 'Employment Agreement';
    }
    if (/loan\s+agreement|credit\s+agreement|facility\s+agreement/i.test(firstLines)) {
      return 'Loan / Credit Agreement';
    }
    if (/service\s+agreement|master\s+services\s+agreement|statement\s+of\s+work/i.test(firstLines)) {
      return 'Service Agreement';
    }

    // Score based on keyword frequencies across profiles
    let bestCategory = 'General Contract / Agreement';
    let highestScore = 0;

    for (const [category, profile] of Object.entries(this.categoryProfiles)) {
      let score = 0;
      for (const kw of profile.keywords) {
        const matches = sample.match(new RegExp(kw.source, 'gi'));
        if (matches) score += matches.length;
      }
      if (score > highestScore && score >= 2) {
        highestScore = score;
        bestCategory = category;
      }
    }

    return bestCategory;
  }

  /**
   * Get expected clauses schema for a given category
   * @param {string} category 
   * @returns {Array<Object>}
   */
  getExpectedClauses(category) {
    const profile = this.categoryProfiles[category];
    return profile ? profile.expectedClauses : [
      { name: 'Parties & Scope', importance: 'high', explanation: 'Clear identification of parties and objectives.' },
      { name: 'Rights & Obligations', importance: 'high', explanation: 'Core performance expectations.' },
      { name: 'Termination', importance: 'high', explanation: 'Conditions and notice period to end the agreement.' },
      { name: 'Dispute Resolution', importance: 'medium', explanation: 'Governing law and jurisdiction for disputes.' }
    ];
  }
}

module.exports = new DocumentClassifier();
