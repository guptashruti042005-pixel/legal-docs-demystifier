import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generates a clean, safe filename based on the document name.
 * Example: 'Bajaj Allianz Life Goal Suraksha.pdf' -> 'Bajaj_Allianz_Life_Goal_Suraksha_Summary.pdf'
 */
export function generateSafeFilename(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    return 'Document_Analysis_Summary.pdf';
  }
  // Strip extension
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  // Replace non-alphanumeric (except dashes and underscores) with underscore
  let safe = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
  // Collapse consecutive underscores and trim
  safe = safe.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (!safe) safe = 'Document';
  return `${safe}_Summary.pdf`;
}

/**
 * Generates and triggers download of a professional multi-page PDF summary report
 * using the currently viewed document analysis data.
 */
export async function generateAnalysisPDF({ analysisRecord, currentAnalysisJSON, currentLang = 'en' }) {
  if (!analysisRecord) {
    throw new Error('No analysis record available for PDF generation.');
  }

  const documentId = analysisRecord.documentId || {};
  const analysis = currentAnalysisJSON || analysisRecord.analysis || {};
  const docName = documentId.fileName || 'Document Analysis';
  const category = analysis.documentType 
    || (documentId.documentType === 'resume' ? 'Resume / CV' : documentId.documentType) 
    || 'General Legal Document';
  const riskLevel = (analysis.riskLevel || analysisRecord.riskLevel || 'low').toUpperCase();
  const confidenceScore = Math.round((analysis.confidenceScore || analysisRecord.confidenceScore || 0.9) * 100);
  const persona = analysisRecord.persona || 'General';
  const status = (documentId.status || 'READY').toUpperCase();

  const isResume = (category || '').toLowerCase().includes('resume')
    || (category || '').toLowerCase().includes('cv')
    || (docName || '').toLowerCase().includes('resume')
    || (docName || '').toLowerCase().includes('cv')
    || (analysis.atsScore !== null && analysis.atsScore !== undefined);

  // Initialize jsPDF document (A4 format, points)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - (margin * 2);
  const topMargin = 45;
  const bottomMargin = 50;
  const maxY = pageHeight - bottomMargin;

  let currentY = topMargin;

  // Helper to ensure enough vertical space or trigger page break
  const ensureSpace = (neededHeight) => {
    if (currentY + neededHeight > maxY) {
      doc.addPage();
      currentY = topMargin + 15;
    }
  };

  // Helper to draw section header
  const drawSectionHeader = (title, sectionNumber) => {
    ensureSpace(45);
    currentY += 8;

    // Accent line on the left
    doc.setFillColor(37, 99, 235); // Blue #2563EB
    doc.roundedRect(margin, currentY - 2, 4, 18, 1, 1, 'F');

    // Section title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42); // Slate #0F172A
    doc.text(`SECTION ${sectionNumber} — ${title.toUpperCase()}`, margin + 12, currentY + 11);

    // Subtle bottom separator
    doc.setDrawColor(226, 232, 240); // Slate #E2E8F0
    doc.setLineWidth(0.75);
    doc.line(margin, currentY + 22, margin + contentWidth, currentY + 22);

    currentY += 32;
  };

  // Helper to draw wrapped paragraphs cleanly across pages
  const drawParagraph = (text, options = {}) => {
    if (!text || typeof text !== 'string') return;
    const fontSize = options.fontSize || 9.5;
    const lineHeight = options.lineHeight || 14;
    const textColor = options.textColor || [51, 65, 85]; // Slate #334155
    const isBold = !!options.bold;
    const isItalic = !!options.italic;

    doc.setFont('helvetica', isBold ? 'bold' : (isItalic ? 'italic' : 'normal'));
    doc.setFontSize(fontSize);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);

    const paragraphs = text.split('\n');
    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (!trimmed) {
        currentY += 6;
        continue;
      }
      const lines = doc.splitTextToSize(trimmed, contentWidth - (options.indent || 0));
      for (const line of lines) {
        ensureSpace(lineHeight);
        doc.text(line, margin + (options.indent || 0), currentY);
        currentY += lineHeight;
      }
      currentY += (options.paragraphGap || 4);
    }
  };

  // Helper to draw a styled callout box
  const drawCalloutBox = ({ title, excerpt, body, badgeText, badgeColor = [37, 99, 235], borderColor = [203, 213, 225] }) => {
    ensureSpace(50);
    const boxStartY = currentY;

    // We first estimate height by splitting lines
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const titleLines = doc.splitTextToSize(title, contentWidth - 110);
    
    let innerY = boxStartY + 14;
    innerY += titleLines.length * 13;

    let excerptLines = [];
    if (excerpt && excerpt !== 'Information Not Found In Document') {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      excerptLines = doc.splitTextToSize(`"${excerpt}"`, contentWidth - 36);
      innerY += excerptLines.length * 11 + 10;
    }

    let bodyLines = [];
    if (body) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      bodyLines = doc.splitTextToSize(body, contentWidth - 24);
      innerY += bodyLines.length * 12 + 6;
    }

    const boxHeight = (innerY - boxStartY) + 8;
    ensureSpace(boxHeight);

    // Draw background and left border
    doc.setFillColor(248, 250, 252); // #F8FAFC
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, currentY, contentWidth, boxHeight, 4, 4, 'FD');

    // Accent left stripe
    doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
    doc.roundedRect(margin, currentY, 3.5, boxHeight, 1, 1, 'F');

    let renderY = currentY + 14;

    // Draw Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    for (const tLine of titleLines) {
      doc.text(tLine, margin + 12, renderY);
      renderY += 13;
    }

    // Draw Badge in top right if provided
    if (badgeText) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      const badgeW = doc.getTextWidth(badgeText) + 12;
      const badgeX = margin + contentWidth - badgeW - 10;
      doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
      doc.roundedRect(badgeX, currentY + 8, badgeW, 14, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(badgeText, badgeX + 6, currentY + 18);
    }

    // Draw Excerpt Box
    if (excerptLines.length > 0) {
      renderY += 2;
      const exHeight = excerptLines.length * 11 + 8;
      doc.setFillColor(241, 245, 249); // #F1F5F9
      doc.roundedRect(margin + 12, renderY - 8, contentWidth - 24, exHeight, 2, 2, 'F');
      
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      for (const exLine of excerptLines) {
        doc.text(exLine, margin + 18, renderY);
        renderY += 11;
      }
      renderY += 6;
    }

    // Draw Body text
    if (bodyLines.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      for (const bLine of bodyLines) {
        doc.text(bLine, margin + 12, renderY);
        renderY += 12;
      }
    }

    currentY += boxHeight + 10;
  };

  // ==========================================
  // 1. REPORT COVER / EXECUTIVE HEADER (Page 1)
  // ==========================================

  // Top branding band
  doc.setFillColor(15, 23, 42); // Deep Navy Slate #0F172A
  doc.rect(margin, currentY, contentWidth, 38, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('LEGAL DOCS DEMYSTIFIER', margin + 14, currentY + 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // Slate #94A3B8
  doc.text('CONFIDENTIAL COMPREHENSIVE DOCUMENT AUDIT REPORT', margin + 14, currentY + 29);

  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`DATE: ${reportDate}`, margin + contentWidth - 14, currentY + 23, { align: 'right' });

  currentY += 46;

  // Document Metadata Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const docTitleLines = doc.splitTextToSize(docName, contentWidth - 28);
  const metaBoxHeight = 52 + (docTitleLines.length * 15);

  doc.setFillColor(248, 250, 252); // #F8FAFC
  doc.setDrawColor(226, 232, 240); // #E2E8F0
  doc.setLineWidth(1);
  doc.roundedRect(margin, currentY, contentWidth, metaBoxHeight, 6, 6, 'FD');

  let titleY = currentY + 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  for (const line of docTitleLines) {
    doc.text(line, margin + 14, titleY);
    titleY += 15;
  }

  // Metadata badges line
  let badgeY = currentY + metaBoxHeight - 16;
  let badgeX = margin + 14;

  const drawBadge = (label, bgRGB, textRGB = [255, 255, 255]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    const textW = doc.getTextWidth(label);
    doc.setFillColor(bgRGB[0], bgRGB[1], bgRGB[2]);
    doc.roundedRect(badgeX, badgeY - 9, textW + 12, 14, 3, 3, 'F');
    doc.setTextColor(textRGB[0], textRGB[1], textRGB[2]);
    doc.text(label, badgeX + 6, badgeY + 1);
    badgeX += textW + 18;
  };

  // Category
  drawBadge(`CATEGORY: ${category.toUpperCase()}`, [30, 41, 59]);

  // Risk Level
  let riskColor = [16, 185, 129]; // Green
  if (riskLevel.includes('HIGH')) riskColor = [239, 68, 68]; // Red
  else if (riskLevel.includes('MED')) riskColor = [245, 158, 11]; // Amber
  drawBadge(`RISK: ${riskLevel}`, riskColor);

  // Confidence
  drawBadge(`CONFIDENCE: ${confidenceScore}%`, [37, 99, 235]);

  // Status
  drawBadge(`STATUS: ${status}`, [5, 150, 105]);

  // Persona
  drawBadge(`VIEW: ${persona.toUpperCase()}`, [71, 85, 105]);

  currentY += metaBoxHeight + 14;

  // ==========================================
  // SECTION 1 — EXECUTIVE SUMMARY
  // ==========================================
  drawSectionHeader('Executive Summary', 1);
  const execSummary = analysis.executiveSummary || analysis.summary || 'No executive summary was generated for this document.';
  drawParagraph(execSummary, { fontSize: 9.5, lineHeight: 14, paragraphGap: 6 });
  currentY += 8;

  // ==========================================
  // SECTION 2 — PLAIN LANGUAGE BREAKDOWN
  // ==========================================
  drawSectionHeader('Plain Language Breakdown', 2);
  const plainSummary = analysis.plainLanguageSummary || 'No detailed plain-language breakdown generated.';
  drawParagraph(plainSummary, { fontSize: 9.5, lineHeight: 14, paragraphGap: 6 });
  currentY += 8;

  // If document is a resume, add resume-specific candidate insights
  if (isResume) {
    if (analysis.atsScore !== null && analysis.atsScore !== undefined) {
      drawSectionHeader('ATS Compatibility & Factor Breakdown', '2A');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`Overall ATS Score: ${analysis.atsScore}%`, margin, currentY);
      currentY += 12;

      if (analysis.atsAssessment) {
        drawParagraph(analysis.atsAssessment, { fontSize: 9, lineHeight: 13, italic: true });
        currentY += 4;
      }

      // Breakdown table
      const breakdown = analysis.atsScoreBreakdown || {};
      const breakdownRows = [
        ['Contact Information', `${breakdown.contact !== undefined ? breakdown.contact : Math.round((analysis.atsScore / 100) * 10)} / 10`],
        ['Core Section Structure', `${breakdown.sections !== undefined ? breakdown.sections : Math.round((analysis.atsScore / 100) * 15)} / 15`],
        ['Technical Skills Breadth', `${breakdown.skills !== undefined ? breakdown.skills : Math.round((analysis.atsScore / 100) * 20)} / 20`],
        ['Experience / Practical Depth', `${breakdown.experience !== undefined ? breakdown.experience : Math.round((analysis.atsScore / 100) * 20)} / 20`],
        ['Education Completeness', `${breakdown.education !== undefined ? breakdown.education : Math.round((analysis.atsScore / 100) * 10)} / 10`],
        ['Hands-on Projects', `${breakdown.projects !== undefined ? breakdown.projects : Math.round((analysis.atsScore / 100) * 15)} / 15`],
        ['Formatting & Parsability', `${breakdown.formatting !== undefined ? breakdown.formatting : Math.round((analysis.atsScore / 100) * 10)} / 10`]
      ];

      autoTable(doc, {
        startY: currentY,
        head: [['ATS Evaluation Factor', 'Score Achieved']],
        body: breakdownRows,
        theme: 'striped',
        margin: { left: margin, right: margin },
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
        bodyStyles: { fontSize: 8.5, textColor: [51, 65, 85] },
        tableWidth: contentWidth,
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 120, halign: 'right', fontStyle: 'bold' }
        }
      });
      currentY = doc.lastAutoTable.finalY + 14;
    }

    // Extracted Skills
    const skills = analysis.skills || analysis.extractedSkills || [];
    if (skills.length > 0) {
      drawSectionHeader('Extracted Candidate Skills', '2B');
      const skillsText = skills.join('  •  ');
      drawParagraph(skillsText, { fontSize: 9, lineHeight: 14 });
      currentY += 8;
    }
  }

  // ==========================================
  // SECTION 3 — KEY CLAUSES
  // ==========================================
  drawSectionHeader('Key Clauses', 3);
  const clauses = analysis.importantClauses || [];

  if (clauses.length > 0) {
    clauses.forEach((cls, idx) => {
      const importance = (cls.importance || 'Medium').toUpperCase();
      let badgeColor = [37, 99, 235];
      if (importance.includes('HIGH')) badgeColor = [185, 28, 28];
      else if (importance.includes('MED')) badgeColor = [217, 119, 6];

      let bodyText = `Explanation: ${cls.explanation || 'No explanation provided.'}`;
      if (cls.category) {
        bodyText += `\nClassification: ${cls.category}`;
      }

      drawCalloutBox({
        title: `${idx + 1}. ${cls.title || 'Clause'}`,
        excerpt: cls.excerpt,
        body: bodyText,
        badgeText: `${importance} IMPORTANCE`,
        badgeColor,
        borderColor: [226, 232, 240]
      });
    });
  } else {
    drawParagraph(
      isResume 
        ? 'No contractual clauses detected. This document is a candidate resume/CV.'
        : 'No specific key contractual clauses were identified in the analyzed document.',
      { italic: true, textColor: [100, 116, 139] }
    );
    currentY += 8;
  }

  // ==========================================
  // SECTION 4 — RED FLAGS & RISKS
  // ==========================================
  drawSectionHeader('Red Flags & Risks', 4);
  const redFlags = analysis.redFlags || [];

  if (redFlags.length > 0) {
    redFlags.forEach((flag, idx) => {
      const severity = (flag.severity || 'Medium').toUpperCase();
      let badgeColor = [220, 38, 38];
      if (severity.includes('LOW')) badgeColor = [16, 185, 129];
      else if (severity.includes('MED')) badgeColor = [245, 158, 11];

      let bodyText = `Risk Assessment: ${flag.risk || 'Risk detected in contract language.'}`;
      if (flag.consequences) {
        bodyText += `\nPotential Consequences: ${flag.consequences}`;
      }

      drawCalloutBox({
        title: `Risk Alert ${idx + 1}: ${flag.title || 'Potential Contractual Risk'}`,
        excerpt: flag.excerpt,
        body: bodyText,
        badgeText: `${severity} SEVERITY`,
        badgeColor,
        borderColor: [254, 202, 202]
      });
    });
  } else {
    // Explicit mandatory requirement:
    // "If there are no supported risks, state: 'No material risks were identified in the analyzed content.' Do not invent risks."
    ensureSpace(36);
    doc.setFillColor(240, 253, 244); // #F0FDF4
    doc.setDrawColor(187, 247, 208); // #BBF7D0
    doc.setLineWidth(0.75);
    doc.roundedRect(margin, currentY, contentWidth, 32, 4, 4, 'FD');

    doc.setFillColor(16, 185, 129); // Emerald
    doc.roundedRect(margin, currentY, 3.5, 32, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(22, 101, 52); // Deep emerald text
    doc.text('No material risks were identified in the analyzed content.', margin + 14, currentY + 19);

    currentY += 40;
  }

  // ==========================================
  // SECTION 5 — OBLIGATIONS & DATES
  // ==========================================
  drawSectionHeader('Obligations & Dates', 5);

  // 5.1 Financial Obligations
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('5.1 Financial Obligations & Penalties', margin, currentY);
  currentY += 10;

  const financialObligations = analysis.financialObligations || [];
  if (financialObligations.length > 0) {
    const finRows = financialObligations.map(ob => [
      ob.description || ob.type || 'Obligation',
      ob.amount || 'Not Specified',
      ob.terms || 'Standard contract terms'
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Obligation Description', 'Amount / Cost', 'Trigger Terms & Schedule']],
      body: finRows,
      theme: 'striped',
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5, textColor: [51, 65, 85] },
      tableWidth: contentWidth,
      columnStyles: {
        0: { cellWidth: 160, fontStyle: 'bold' },
        1: { cellWidth: 100 },
        2: { cellWidth: 'auto' }
      }
    });
    currentY = doc.lastAutoTable.finalY + 14;
  } else {
    drawParagraph('No material financial obligations or penalties detected in the document text.', {
      italic: true,
      textColor: [100, 116, 139]
    });
    currentY += 6;
  }

  // 5.2 Critical Dates & Timeframes
  ensureSpace(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('5.2 Critical Dates, Deadlines & Operative Timeframes', margin, currentY);
  currentY += 10;

  const importantDates = analysis.importantDates || [];
  if (importantDates.length > 0) {
    const dateRows = importantDates.map(dt => [
      dt.description || 'Milestone / Event',
      dt.date || 'Specified timeframe',
      dt.significance || dt.impact || 'Critical milestone'
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Event / Milestone Description', 'Critical Date / Timeframe', 'Significance & Impact']],
      body: dateRows,
      theme: 'striped',
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5, textColor: [51, 65, 85] },
      tableWidth: contentWidth,
      columnStyles: {
        0: { cellWidth: 160, fontStyle: 'bold' },
        1: { cellWidth: 100 },
        2: { cellWidth: 'auto' }
      }
    });
    currentY = doc.lastAutoTable.finalY + 14;
  } else {
    drawParagraph('No critical dates, deadlines, grace periods, or milestone timeframes detected.', {
      italic: true,
      textColor: [100, 116, 139]
    });
    currentY += 8;
  }

  // ==========================================
  // SECTION 6 — MISSING CLAUSES
  // ==========================================
  drawSectionHeader('Missing Clauses', 6);
  const missingClauses = analysis.missingClauses || [];

  if (missingClauses.length > 0) {
    missingClauses.forEach((mc, idx) => {
      let bodyText = `Status: Not identified in the analyzed document.\nRationale: ${mc.explanation || 'Standard protective clause recommended for this document category.'}`;
      drawCalloutBox({
        title: `${idx + 1}. Missing Protective Clause: ${mc.clause || 'Unspecified Clause'}`,
        body: bodyText,
        badgeText: 'PROTECTIVE GAP',
        badgeColor: [147, 51, 234], // Purple #9333EA
        borderColor: [233, 213, 255]
      });
    });
  } else {
    drawParagraph(
      isResume
        ? 'No missing clause analysis applicable for candidate resumes.'
        : 'No critical missing clauses detected. The agreement covers typical category safeguards.',
      { italic: true, textColor: [100, 116, 139] }
    );
    currentY += 8;
  }

  // ==========================================
  // SECTION 7 — ACTION CHECKLIST & CAVEATS
  // ==========================================
  drawSectionHeader('Action Checklist & Caveats', 7);

  // Recommendations
  const recs = analysis.recommendations || [];
  const actionItems = analysis.actionItems || [];
  const resumeFeedback = analysis.resumeFeedback || {};
  const feedbackImprovements = Array.isArray(resumeFeedback.improvements) ? resumeFeedback.improvements : [];

  const combinedActions = [];
  if (recs.length > 0) {
    recs.forEach(r => {
      combinedActions.push({
        action: r.action || 'Recommended Action',
        rationale: r.rationale || '',
        priority: r.priority || ''
      });
    });
  } else if (actionItems.length > 0) {
    actionItems.forEach(item => {
      combinedActions.push({ action: item, rationale: '' });
    });
  } else if (feedbackImprovements.length > 0) {
    feedbackImprovements.forEach(item => {
      combinedActions.push({ action: item, rationale: 'Resume ATS optimization item' });
    });
  }

  if (combinedActions.length > 0) {
    combinedActions.forEach((item, idx) => {
      ensureSpace(28);
      
      // Checkbox bullet
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(1);
      doc.rect(margin + 2, currentY - 8, 8, 8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      const actionLines = doc.splitTextToSize(item.action, contentWidth - 24);
      for (const line of actionLines) {
        doc.text(line, margin + 16, currentY);
        currentY += 12;
      }

      if (item.rationale) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        const ratLines = doc.splitTextToSize(`Rationale: ${item.rationale}`, contentWidth - 24);
        for (const line of ratLines) {
          ensureSpace(11);
          doc.text(line, margin + 16, currentY);
          currentY += 11;
        }
      }
      currentY += 4;
    });
    currentY += 6;
  } else {
    drawParagraph('No specific operational action items identified for this document.', {
      italic: true,
      textColor: [100, 116, 139]
    });
    currentY += 6;
  }

  // Hidden Caveats if present
  const caveats = analysis.hiddenCaveats || [];
  if (caveats.length > 0) {
    ensureSpace(35);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(180, 83, 9); // Amber
    doc.text('Warning Caveats & Trap Clauses:', margin, currentY);
    currentY += 12;

    caveats.forEach((cav, i) => {
      ensureSpace(20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(217, 119, 6);
      doc.text('⚠', margin + 2, currentY);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(67, 56, 202);
      const cavLines = doc.splitTextToSize(cav, contentWidth - 20);
      for (const line of cavLines) {
        ensureSpace(12);
        doc.text(line, margin + 16, currentY);
        currentY += 12;
      }
      currentY += 3;
    });
    currentY += 6;
  }

  // ==========================================
  // SECTION 8 — ANALYSIS CAVEAT
  // ==========================================
  drawSectionHeader('Analysis Caveat', 8);

  const caveatText = 'LEGAL NOTICE & DISCLAIMER: This document analysis report was generated by Legal Docs Demystifier using artificial intelligence. It is provided strictly for educational, informational, and organizational review purposes. This report does not constitute formal legal, financial, investment, or regulatory advice, nor does it create an attorney-client relationship. Artificial intelligence analysis may not capture every contractual nuance or jurisdictional statutory requirement. You should consult a licensed attorney or certified financial advisor prior to executing, altering, or terminating binding legal agreements.';

  ensureSpace(50);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.75);

  const caveatLines = doc.splitTextToSize(caveatText, contentWidth - 24);
  const caveatBoxHeight = caveatLines.length * 11 + 16;
  ensureSpace(caveatBoxHeight);

  doc.roundedRect(margin, currentY, contentWidth, caveatBoxHeight, 4, 4, 'FD');
  doc.setFillColor(100, 116, 139);
  doc.roundedRect(margin, currentY, 3, caveatBoxHeight, 1, 1, 'F');

  let cavY = currentY + 13;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  for (const line of caveatLines) {
    doc.text(line, margin + 14, cavY);
    cavY += 11;
  }
  currentY += caveatBoxHeight + 10;

  // ==========================================
  // RUNNING HEADERS & FOOTERS (All Pages)
  // ==========================================
  const totalPages = doc.getNumberOfPages();

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);

    // Running header on page 2 and subsequent
    if (pageNum > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // #94A3B8
      doc.text('LEGAL DOCS DEMYSTIFIER', margin, 28);

      const truncatedName = docName.length > 40 ? `${docName.substring(0, 37)}...` : docName;
      doc.text(`Doc: ${truncatedName}`, margin + contentWidth, 28, { align: 'right' });

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, 34, margin + contentWidth, 34);
    }

    // Running footer on ALL pages
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 34, margin + contentWidth, pageHeight - 34);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Confidential • AI-Assisted Document Analysis', margin, pageHeight - 22);
    doc.text(`Page ${pageNum} of ${totalPages}`, margin + contentWidth, pageHeight - 22, { align: 'right' });
  }

  // Trigger safe automatic download in browser
  const safeFilename = generateSafeFilename(docName);
  if (typeof window !== 'undefined' && typeof doc.save === 'function') {
    doc.save(safeFilename);
  }

  return {
    success: true,
    filename: safeFilename,
    pages: totalPages,
    doc
  };
}
