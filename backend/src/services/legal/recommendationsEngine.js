/**
 * Grounded Recommendations & Action Checklist Engine.
 * Generates actionable suggestions and checkable items DERIVED EXCLUSIVELY
 * from detected clauses and document text.
 * Strictly avoids generic contract boilerplate.
 */

class RecommendationsEngine {
  /**
   * Generate grounded recommendations from detected clauses and risks
   * @param {Array<Object>} clauses - Detected clauses
   * @param {Array<Object>} risks - Detected risks
   * @param {string} category - Document category
   * @returns {{ recommendations: Array<Object>, actionItems: Array<string> }}
   */
  generateRecommendations(clauses = [], risks = [], category = 'General Contract / Agreement') {
    const recommendations = [];
    const actionItems = [];
    const seenActions = new Set();

    const addRec = (action, rationale, sourceClause, priority = 'medium') => {
      if (!seenActions.has(action)) {
        seenActions.add(action);
        recommendations.push({
          action,
          recommendation: action,
          rationale,
          reason: rationale,
          source_clause: sourceClause,
          priority
        });
        actionItems.push(action);
      }
    };

    // Check detected clauses
    for (const c of clauses) {
      const titleLower = (c.title || '').toLowerCase();

      if (titleLower.includes('free look')) {
        addRec(
          'Exercise Free-Look Cancellation Right if Dissatisfied',
          'Thoroughly audit the policy schedule, benefits, and exclusions within the statutory 15–30 day window to return the document for a full premium refund if terms do not meet expectations.',
          c.title,
          'high'
        );
      } else if (titleLower.includes('grace period') || titleLower.includes('lapse')) {
        addRec(
          'Calendar Grace Period Remittance Deadlines',
          'Set automated reminders to remit renewal premiums within the 15–30 day grace period to prevent policy lapse or forfeiture of accrued benefits.',
          c.title,
          'high'
        );
      } else if (titleLower.includes('surrender')) {
        addRec(
          'Verify Guaranteed Surrender Value Schedule Prior to Exit',
          'Inspect the surrender value factor tables and lock-in requirements before terminating early to avoid severe financial forfeiture of premiums paid.',
          c.title,
          'medium'
        );
      } else if (titleLower.includes('exclusion')) {
        addRec(
          'Review Policy Exclusions & Inform Nominees',
          'Examine specific exclusions (such as suicide within 12 months) and ensure designated beneficiaries understand documentation needed for future claims.',
          c.title,
          'medium'
        );
      } else if (titleLower.includes('assignment')) {
        addRec(
          'Follow Formal Endorsement Rules for Policy Assignment',
          'Deliver written notice and obtain official company endorsement under Section 38 of the Insurance Act when assigning policy benefits as loan collateral.',
          c.title,
          'medium'
        );
      } else if (titleLower.includes('ombudsman') || titleLower.includes('grievance')) {
        addRec(
          'Document Grievance Escalation Channels',
          'Note the contact details of the Insurance Ombudsman (Bimalokpal) and company Grievance Officer in case of claim disputes or delays.',
          c.title,
          'low'
        );
      } else if (titleLower.includes('termination')) {
        addRec(
          'Adhere to Formal Written Notice Protocols for Termination',
          'Ensure any cancellation or separation notice complies strictly with the written notice duration and delivery methods stipulated in the contract.',
          c.title,
          'high'
        );
      } else if (titleLower.includes('confidentiality')) {
        addRec(
          'Mark and Restrict Handling of Proprietary Information',
          'Ensure proprietary disclosures are clearly designated as confidential and access is restricted to authorized personnel under non-disclosure obligations.',
          c.title,
          'medium'
        );
      } else if (titleLower.includes('non-compete')) {
        addRec(
          'Clarify Geographic and Scope Limits of Post-Employment Restraints',
          'Confirm that non-compete or non-solicitation restrictions are reasonably bounded in time and geography to prevent undue career constraints.',
          c.title,
          'high'
        );
      } else if (titleLower.includes('invoicing') || titleLower.includes('compensation') || (titleLower.includes('payment terms') && category !== 'Insurance Policy')) {
        addRec(
          'Reconcile Invoicing Schedules with Milestone Acceptance',
          'Align invoice submission dates and payment milestones with verified client acceptance of deliverables.',
          c.title,
          'medium'
        );
      }
    }

    // Check detected risks
    for (const r of risks) {
      const rTitle = (r.title || '').toLowerCase();
      if (rTitle.includes('foreclosure')) {
        addRec(
          'Monitor Outstanding Policy Loan Balances',
          'Keep outstanding loan principal and interest below total surrender value to prevent unilateral policy foreclosure and loss of coverage.',
          r.title,
          'high'
        );
      } else if (rTitle.includes('misstatement') || rTitle.includes('section 45')) {
        addRec(
          'Verify Accuracy of Declarations and Age Proof',
          'Ensure all health history, medical records, and age documents submitted during proposal are fully accurate to prevent claim repudiation under Section 45.',
          r.title,
          'high'
        );
      }
    }

    // Safe fallback if document has few detected clauses
    if (recommendations.length === 0) {
      addRec(
        'Perform Document-Specific Legal Review',
        'Review the specific rights, deadlines, and termination procedures outlined in the agreement before signing.',
        'General Terms',
        'medium'
      );
    }

    return { recommendations, actionItems };
  }
}

module.exports = new RecommendationsEngine();
