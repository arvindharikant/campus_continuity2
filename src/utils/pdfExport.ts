import { jsPDF } from 'jspdf';
import { HandoverReport, Project } from '../types/models';

export function exportHandoverReportToPdf(
  report: HandoverReport,
  project?: Project | null,
  continuityScore?: number
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const maxWidth = pageWidth - margin * 2;
  let y = 50;

  // Cover Header Banner (Navy Blue #0F172A)
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 112, 'F');

  // Accent line (Emerald #059669)
  doc.setFillColor(5, 150, 105);
  doc.rect(0, 112, pageWidth, 4, 'F');

  doc.setTextColor(16, 185, 129);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('CAMPUS CONTINUITY · PRESERVE KNOWLEDGE. CONTINUE INNOVATION.', margin, 26);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('ACADEMIC & TECHNICAL PROJECT HANDOVER REPORT', margin, 46);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  const titleLines = doc.splitTextToSize(report.title || 'Project Handover Package', maxWidth);
  doc.text(titleLines[0] || 'Project Handover Package', margin, 64);

  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  const metaLine1 = `Project: ${project?.name || 'Not documented'} (${project?.code || 'PRJ'})  |  Department: ${project?.department || 'Not documented'}  |  Continuity Score: ${continuityScore !== undefined ? `${continuityScore}/100` : 'Evaluated'}`;
  const metaLine2 = `Departing Member: ${project?.departingMember || 'Not documented'}  |  Incoming Recipient: ${report.recipientName || project?.incomingMember || 'Not documented'}  |  Target Date: ${project?.targetHandoverDate || 'Not documented'}`;
  doc.text(metaLine1, margin, 82);
  doc.text(metaLine2, margin, 96);

  y = 138;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 50) {
      doc.addPage();
      y = 50;
    }
  };

  // Table of Contents Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, maxWidth, 94, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('TABLE OF CONTENTS & HANDOVER STRUCTURE', margin + 12, y + 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const tocLeft = [
    '01. Executive Summary & Project Overview',
    '02. Verified Completed Work & Milestones',
    '03. Pending Tasks & Ownership Matrix',
    '04. Key Technical & Architectural Decisions',
  ];
  const tocRight = [
    '05. Identified Risks, Blockers & Dependencies',
    '06. Knowledge Gaps, Contradictions & Open Questions',
    '07. Incoming Team Onboarding Checklist & Next Steps',
    `Generated: ${new Date().toISOString().slice(0, 10)} · Status: ${report.shareStatus.toUpperCase()}`,
  ];
  tocLeft.forEach((item, idx) => {
    doc.text(item, margin + 12, y + 36 + idx * 13);
  });
  tocRight.forEach((item, idx) => {
    doc.text(item, margin + maxWidth / 2, y + 36 + idx * 13);
  });

  y += 116;

  const renderSection = (sectionNumber: string, heading: string, body: string) => {
    ensureSpace(64);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${sectionNumber}. ${heading}`, margin, y);
    y += 8;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 15;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);

    const safeBody = body && body.trim().length > 0 ? body.trim() : 'Not documented';
    const paragraphs = safeBody.split('\n');
    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) {
        y += 6;
        continue;
      }
      const wrapped = doc.splitTextToSize(trimmed, maxWidth);
      for (const line of wrapped) {
        ensureSpace(15);
        doc.text(line, margin, y);
        y += 13.5;
      }
      y += 4;
    }
    y += 14;
  };

  renderSection(
    '01',
    'Executive Summary, Problem Statement & Project Overview',
    report.overviewSection || 'Not documented'
  );
  renderSection(
    '02',
    'Verified Completed Work & Modules Implemented',
    report.completedWorkSection || 'Not documented'
  );
  renderSection(
    '03',
    'Pending Work, Future Roadmap & Responsible Owners',
    report.pendingWorkSection || 'Not documented'
  );
  renderSection(
    '04',
    'Key Architectural & Technical Decisions (with Rationale)',
    report.decisionsSection || 'Not documented'
  );
  renderSection(
    '05',
    'Identified Risks, Blockers & External Dependencies',
    report.risksDependenciesSection || 'Not documented'
  );
  renderSection(
    '06',
    'Knowledge Gaps, Evidence Contradictions & Unresolved Issues',
    report.unresolvedIssuesSection || 'Not documented'
  );
  renderSection(
    '07',
    'Incoming Team Onboarding Checklist & Recommended Next Actions',
    report.nextActionsSection || 'Not documented'
  );

  // Page numbering footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Campus Continuity Platform  ·  Evidence-Verified Handover Package (${project?.code || 'PRJ'})  ·  Page ${i} of ${totalPages}`,
      margin,
      pageHeight - 24
    );
  }

  const safeSlug = (report.title || 'campus_continuity_handover_report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  doc.save(`${safeSlug}.pdf`);
}
