import {
  Project,
  ProjectDocument,
  ExtractedKnowledge,
  Decision,
  TaskItem,
  RiskItem,
  DependencyItem,
  HandoverReport,
  ContradictionItem,
  MissingInfoItem,
} from '../types/models';

export interface ContinuityCategoryScore {
  id: 'documentation' | 'tasks' | 'decisions' | 'risks' | 'handover';
  label: string;
  earnedPoints: number;
  maxPoints: number;
  percentage: number;
  status: 'strong' | 'moderate' | 'needs_attention';
  summary: string;
}

export interface ContinuityDeduction {
  category: string;
  pointsLost: number;
  reason: string;
  recommendation: string;
  actionPath: string;
}

export interface DetectedKnowledgeGap {
  id: string;
  title: string;
  category:
    | 'Unassigned Task'
    | 'Missing Rationale'
    | 'Critical Blocker'
    | 'Undocumented Dependency'
    | 'Missing Documentation'
    | 'Evidence Contradiction'
    | 'AI Identified Risk';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendedAction: string;
  sourceReference: string;
  isResolved: boolean;
  linkedRiskId?: string;
  linkedTaskId?: string;
  linkedDecisionId?: string;
}

export interface ProjectContinuityReport {
  totalScore: number;
  readinessLevel: 'Handover Ready' | 'Moderate Continuity' | 'At Risk' | 'Critical Knowledge Loss Risk';
  categories: ContinuityCategoryScore[];
  deductions: ContinuityDeduction[];
  recommendations: string[];
  detectedGaps: DetectedKnowledgeGap[];
  handoverChecklist: {
    hasProjectMetadata: boolean;
    hasUploadedDocs: boolean;
    hasAnalyzedDocs: boolean;
    hasAssignedPendingTasks: boolean;
    hasVerifiedDecisions: boolean;
    hasMitigatedCriticalRisks: boolean;
    isReadyForFinalHandover: boolean;
    warnings: string[];
  };
}

export function calculateProjectContinuityScore(params: {
  project: Project | null;
  documents: ProjectDocument[];
  knowledge: ExtractedKnowledge | null;
  decisions: Decision[];
  tasks: TaskItem[];
  risks: RiskItem[];
  dependencies: DependencyItem[];
  handovers: HandoverReport[];
}): ProjectContinuityReport {
  const {
    project,
    documents,
    knowledge,
    decisions,
    tasks,
    risks,
    dependencies,
    handovers,
  } = params;

  const deductions: ContinuityDeduction[] = [];
  const recommendations: string[] = [];
  const detectedGaps: DetectedKnowledgeGap[] = [];

  // Parse contradictions & missing info from knowledge record
  let contradictions: ContradictionItem[] = [];
  let missingInfo: MissingInfoItem[] = [];
  if (knowledge?.contradictions) {
    try {
      const parsed = JSON.parse(knowledge.contradictions);
      if (Array.isArray(parsed)) contradictions = parsed;
    } catch {
      contradictions = [];
    }
  }
  if (knowledge?.missingInformation) {
    try {
      const parsed = JSON.parse(knowledge.missingInformation);
      if (Array.isArray(parsed)) missingInfo = parsed;
    } catch {
      missingInfo = [];
    }
  }

  // =========================================================================
  // 1. DOCUMENTATION COMPLETENESS (Max 25 Points)
  // =========================================================================
  let docPoints = 0;

  if (project && project.description && project.description.trim().length >= 20) {
    docPoints += 5;
  } else {
    deductions.push({
      category: 'Documentation Completeness',
      pointsLost: 5,
      reason: 'Project description or academic problem statement is brief or missing.',
      recommendation: 'Add a clear project objective and problem statement in Projects settings.',
      actionPath: '/projects',
    });
  }

  if (
    project &&
    project.departingMember?.trim() &&
    project.incomingMember?.trim() &&
    project.targetHandoverDate?.trim()
  ) {
    docPoints += 5;
  } else {
    deductions.push({
      category: 'Documentation Completeness',
      pointsLost: 5,
      reason: 'Departing student/member, incoming successor, or target handover date is incomplete.',
      recommendation: 'Assign both departing and incoming team leads and a target handover date.',
      actionPath: '/projects',
    });
  }

  if (documents.length >= 1) {
    docPoints += 5;
  } else {
    deductions.push({
      category: 'Documentation Completeness',
      pointsLost: 5,
      reason: 'No project documents uploaded to the workspace yet.',
      recommendation: 'Upload project reports, architecture specs, or meeting notes in Document Management.',
      actionPath: '/documents',
    });
    detectedGaps.push({
      id: 'gap-no-docs',
      title: 'No Project Documentation Uploaded',
      category: 'Missing Documentation',
      severity: 'critical',
      description:
        'The project workspace does not contain any uploaded PDF, DOCX, TXT, or Markdown artifacts.',
      recommendedAction:
        'Upload technical architecture documentation, sprint/semester reports, or handover notes.',
      sourceReference: 'Project Document Vault',
      isResolved: false,
    });
  }

  if (documents.length >= 2) {
    docPoints += 5;
  } else if (documents.length === 1) {
    deductions.push({
      category: 'Documentation Completeness',
      pointsLost: 5,
      reason: 'Single-document corpus limits cross-document verification.',
      recommendation: 'Upload at least 2 project documents (e.g., architecture spec + handover notes).',
      actionPath: '/documents',
    });
  }

  const analysedDocs = documents.filter((d) => d.analysisStatus === 'analysed');
  if (documents.length > 0 && analysedDocs.length === documents.length) {
    docPoints += 5;
  } else {
    deductions.push({
      category: 'Documentation Completeness',
      pointsLost: 5,
      reason:
        documents.length === 0
          ? 'No documents have been analyzed by the AI knowledge engine.'
          : `${documents.length - analysedDocs.length} uploaded document(s) have not been analyzed yet.`,
      recommendation: 'Run AI Knowledge Reconstruction on all uploaded project documents.',
      actionPath: '/reconstruction',
    });
  }

  // Check if setup/deployment instructions appear in uploaded docs
  const combinedCorpusLower = documents
    .map((d) => d.extractedText.toLowerCase())
    .join(' ');
  if (
    documents.length > 0 &&
    !/(deploy|install|setup|runbook|environment|config|docker|kubernetes|spanner|database)/i.test(
      combinedCorpusLower
    )
  ) {
    detectedGaps.push({
      id: 'gap-missing-setup',
      title: 'Missing Setup or Deployment Instructions',
      category: 'Missing Documentation',
      severity: 'medium',
      description:
        'Uploaded documents do not explicitly detail environment setup, deployment procedures, or system runbook commands.',
      recommendedAction:
        'Upload a README, deployment guide, or setup memo so incoming students can run the system.',
      sourceReference: 'Corpus Scan',
      isResolved: false,
    });
  }

  // =========================================================================
  // 2. TASK TRACKING COMPLETENESS (Max 20 Points)
  // =========================================================================
  let taskPoints = 0;
  const completedTasks = tasks.filter((t) => t.taskStatus === 'completed');
  const pendingTasks = tasks.filter((t) => t.taskStatus !== 'completed');
  const unassignedPendingTasks = pendingTasks.filter(
    (t) =>
      !t.assignedOwner ||
      t.assignedOwner.toLowerCase().includes('unassigned') ||
      t.assignedOwner.toLowerCase().includes('not stated')
  );
  const approvedTasks = tasks.filter((t) => t.reviewStatus === 'approved');

  if (tasks.length > 0) {
    taskPoints += 5;
  } else {
    deductions.push({
      category: 'Task Tracking Completeness',
      pointsLost: 5,
      reason: 'No completed or pending project tasks have been extracted or recorded.',
      recommendation: 'Run AI Reconstruction or manually add project tasks in Tasks & Decisions.',
      actionPath: '/review',
    });
  }

  if (tasks.length > 0 && unassignedPendingTasks.length === 0) {
    taskPoints += 5;
  } else if (unassignedPendingTasks.length > 0) {
    deductions.push({
      category: 'Task Tracking Completeness',
      pointsLost: 5,
      reason: `${unassignedPendingTasks.length} unfinished task(s) lack an assigned responsible person.`,
      recommendation: 'Assign a verified responsible owner to every pending task.',
      actionPath: '/review',
    });
  }

  for (const ut of unassignedPendingTasks) {
    detectedGaps.push({
      id: `gap-task-owner-${ut.id}`,
      title: `Unassigned Pending Task: ${ut.title}`,
      category: 'Unassigned Task',
      severity: ut.priority === 'critical' ? 'critical' : 'high',
      description: `Pending task "${ut.title}" has no assigned owner (${ut.assignedOwner}).`,
      recommendedAction: 'Edit the task in Tasks & Decisions to assign an incoming student or team member.',
      sourceReference: ut.sourceDocumentName || 'Tasks Register',
      isResolved: ut.reviewStatus === 'approved' && !ut.assignedOwner.toLowerCase().includes('unassigned'),
      linkedTaskId: ut.id,
    });
  }

  if (completedTasks.length > 0) {
    taskPoints += 5;
  } else {
    deductions.push({
      category: 'Task Tracking Completeness',
      pointsLost: 5,
      reason: 'No completed project milestones or finished deliverables are verified yet.',
      recommendation: 'Verify completed tasks so incoming members know what has already been built.',
      actionPath: '/review',
    });
  }

  if (tasks.length > 0 && approvedTasks.length >= Math.ceil(tasks.length * 0.5)) {
    taskPoints += 5;
  } else {
    deductions.push({
      category: 'Task Tracking Completeness',
      pointsLost: 5,
      reason:
        tasks.length === 0
          ? 'No tasks have undergone human verification.'
          : `Only ${approvedTasks.length} of ${tasks.length} tasks have been human-approved.`,
      recommendation: 'Review and approve extracted tasks in Tasks & Decisions.',
      actionPath: '/review',
    });
  }

  // =========================================================================
  // 3. DECISION DOCUMENTATION (Max 20 Points)
  // =========================================================================
  let decisionPoints = 0;
  const decisionsWithoutRationale = decisions.filter(
    (d) =>
      !d.rationale ||
      d.rationale.trim().length < 12 ||
      d.rationale.toLowerCase().includes('not stated')
  );
  const verifiedDecisions = decisions.filter(
    (d) => d.evidenceType === 'verified' && d.sourceQuote && d.sourceQuote.trim().length > 10
  );
  const approvedDecisions = decisions.filter((d) => d.reviewStatus === 'approved');

  if (decisions.length > 0) {
    decisionPoints += 5;
  } else {
    deductions.push({
      category: 'Decision Documentation',
      pointsLost: 5,
      reason: 'No technical or architectural decisions are documented for this project.',
      recommendation: 'Extract or manually record key architecture and design decisions.',
      actionPath: '/review',
    });
  }

  if (decisions.length > 0 && decisionsWithoutRationale.length === 0) {
    decisionPoints += 5;
  } else if (decisions.length > 0) {
    deductions.push({
      category: 'Decision Documentation',
      pointsLost: 5,
      reason: `${decisionsWithoutRationale.length} decision(s) lack a clear technical rationale.`,
      recommendation: 'Add the "Why" rationale behind each technical decision in Tasks & Decisions.',
      actionPath: '/review',
    });
  }

  for (const dwr of decisionsWithoutRationale) {
    detectedGaps.push({
      id: `gap-dec-rationale-${dwr.id}`,
      title: `Decision Missing Rationale: ${dwr.title}`,
      category: 'Missing Rationale',
      severity: 'medium',
      description: `Technical decision "${dwr.title}" does not explain why alternatives were rejected.`,
      recommendedAction: 'Edit the decision record to document the engineering or research rationale.',
      sourceReference: dwr.sourceDocumentName || 'Decision Log',
      isResolved: dwr.reviewStatus === 'approved',
      linkedDecisionId: dwr.id,
    });
  }

  if (decisions.length > 0 && verifiedDecisions.length >= Math.ceil(decisions.length * 0.5)) {
    decisionPoints += 5;
  } else {
    deductions.push({
      category: 'Decision Documentation',
      pointsLost: 5,
      reason: 'Fewer than 50% of recorded decisions have verified source quotes.',
      recommendation: 'Ensure architectural decisions link to verbatim document quotes.',
      actionPath: '/review',
    });
  }

  if (decisions.length > 0 && approvedDecisions.length >= Math.ceil(decisions.length * 0.5)) {
    decisionPoints += 5;
  } else {
    deductions.push({
      category: 'Decision Documentation',
      pointsLost: 5,
      reason:
        decisions.length === 0
          ? 'No decisions have been approved by a human reviewer.'
          : `Only ${approvedDecisions.length} of ${decisions.length} decisions are human-approved.`,
      recommendation: 'Approve verified architectural decisions in Tasks & Decisions.',
      actionPath: '/review',
    });
  }

  // =========================================================================
  // 4. RISK & BLOCKER MANAGEMENT (Max 20 Points)
  // =========================================================================
  let riskPoints = 0;
  const blockedTasks = tasks.filter((t) => t.taskStatus === 'blocked');
  const criticalOrHighRisks = risks.filter(
    (r) => r.severity === 'critical' || r.severity === 'high'
  );
  const risksMissingMitigation = criticalOrHighRisks.filter(
    (r) => !r.mitigationPlan || r.mitigationPlan.trim().length < 10
  );
  const resolvedRisks = risks.filter((r) => r.reviewStatus === 'approved');

  if (risks.length > 0 || dependencies.length > 0) {
    riskPoints += 5;
  } else {
    deductions.push({
      category: 'Risk & Blocker Management',
      pointsLost: 5,
      reason: 'No project risks, blockers, or external dependencies have been cataloged.',
      recommendation: 'Run AI Reconstruction or log project risks in the Project Risks detector.',
      actionPath: '/risks',
    });
  }

  if ((risks.length > 0 || dependencies.length > 0) && risksMissingMitigation.length === 0) {
    riskPoints += 5;
  } else if (risksMissingMitigation.length > 0) {
    deductions.push({
      category: 'Risk & Blocker Management',
      pointsLost: 5,
      reason: `${risksMissingMitigation.length} critical/high risk(s) lack a documented mitigation plan.`,
      recommendation: 'Document concrete mitigation steps for all high-severity project risks.',
      actionPath: '/risks',
    });
  }

  if (tasks.length > 0 && blockedTasks.length === 0) {
    riskPoints += 5;
  } else if (blockedTasks.length > 0) {
    deductions.push({
      category: 'Risk & Blocker Management',
      pointsLost: 5,
      reason: `${blockedTasks.length} project task(s) are currently marked as BLOCKED.`,
      recommendation: 'Resolve or document escalation paths for blocked tasks before handover.',
      actionPath: '/risks',
    });
  }

  if (risks.length > 0 && resolvedRisks.length >= Math.ceil(risks.length * 0.5)) {
    riskPoints += 5;
  } else {
    deductions.push({
      category: 'Risk & Blocker Management',
      pointsLost: 5,
      reason:
        risks.length === 0
          ? 'No identified risks have been reviewed or marked resolved.'
          : `${risks.length - resolvedRisks.length} identified risk(s) remain unverified/unresolved.`,
      recommendation: 'Review and mark mitigated risks as Resolved in Project Risks.',
      actionPath: '/risks',
    });
  }

  // Add AI-identified risks, contradictions, and missing info items into detectedGaps
  for (const r of risks) {
    if (r.reviewStatus === 'rejected') continue;
    detectedGaps.push({
      id: `risk-item-${r.id}`,
      title: r.title,
      category: r.severity === 'critical' ? 'Critical Blocker' : 'AI Identified Risk',
      severity: r.severity,
      description: r.description,
      recommendedAction:
        r.mitigationPlan || 'Review risk with departing team lead and establish mitigation plan.',
      sourceReference: r.sourceDocumentName || 'Project Risk Register',
      isResolved: r.reviewStatus === 'approved',
      linkedRiskId: r.id,
    });
  }

  for (let i = 0; i < contradictions.length; i++) {
    const c = contradictions[i];
    detectedGaps.push({
      id: `contradiction-${i}`,
      title: `Cross-Document Contradiction: ${c.topic}`,
      category: 'Evidence Contradiction',
      severity: 'high',
      description: `${c.conflictDescription} (${c.sourceA} vs. ${c.sourceB})`,
      recommendedAction: c.resolutionRecommendation,
      sourceReference: `${c.sourceA} & ${c.sourceB}`,
      isResolved: false,
    });
  }

  for (let i = 0; i < missingInfo.length; i++) {
    const m = missingInfo[i];
    detectedGaps.push({
      id: `missing-info-${i}`,
      title: `Missing Knowledge: ${m.missingItem}`,
      category: 'Missing Documentation',
      severity: 'high',
      description: `Impact: ${m.impact}`,
      recommendedAction: `Consult ${m.whoToAsk} and document the answer before final handover.`,
      sourceReference: `Consult: ${m.whoToAsk}`,
      isResolved: false,
    });
  }

  for (const dep of dependencies) {
    if (
      dep.status === 'at_risk' ||
      dep.status === 'blocked' ||
      dep.ownerContact.toLowerCase().includes('not specified')
    ) {
      detectedGaps.push({
        id: `dep-gap-${dep.id}`,
        title: `Dependency Exposure: ${dep.name}`,
        category: 'Undocumented Dependency',
        severity: dep.status === 'blocked' ? 'critical' : 'medium',
        description: `${dep.description} (Contact: ${dep.ownerContact}, Status: ${dep.status})`,
        recommendedAction: 'Verify external dependency contact and access credentials for incoming team.',
        sourceReference: dep.sourceDocumentName || 'Dependency Register',
        isResolved: dep.reviewStatus === 'approved',
      });
    }
  }

  // =========================================================================
  // 5. HANDOVER READINESS (Max 15 Points)
  // =========================================================================
  let handoverPoints = 0;

  if (knowledge && knowledge.executiveSummary && knowledge.executiveSummary.trim().length > 20) {
    handoverPoints += 5;
  } else {
    deductions.push({
      category: 'Handover Readiness',
      pointsLost: 5,
      reason: 'AI executive summary and next-step transition roadmap have not been generated yet.',
      recommendation: 'Run AI Knowledge Reconstruction to synthesize the executive handover summary.',
      actionPath: '/reconstruction',
    });
  }

  if (handovers.length > 0) {
    handoverPoints += 5;
  } else {
    deductions.push({
      category: 'Handover Readiness',
      pointsLost: 5,
      reason: 'No structured Handover Report package has been generated yet.',
      recommendation: 'Generate a structured Handover Report in the Handover Reports workspace.',
      actionPath: '/handover',
    });
  }

  const publishedHandovers = handovers.filter((h) => h.shareStatus === 'published');
  if (publishedHandovers.length > 0) {
    handoverPoints += 5;
  } else {
    deductions.push({
      category: 'Handover Readiness',
      pointsLost: 5,
      reason: 'No Handover Report has been approved and published for incoming team members.',
      recommendation: 'Approve and publish the generated Handover Report and export the final PDF.',
      actionPath: '/handover',
    });
  }

  // =========================================================================
  // COMPILE FINAL SCORE & CATEGORIES
  // =========================================================================
  const makeCat = (
    id: ContinuityCategoryScore['id'],
    label: string,
    earned: number,
    max: number,
    summary: string
  ): ContinuityCategoryScore => {
    const pct = Math.round((earned / max) * 100);
    return {
      id,
      label,
      earnedPoints: earned,
      maxPoints: max,
      percentage: pct,
      status: pct >= 80 ? 'strong' : pct >= 50 ? 'moderate' : 'needs_attention',
      summary,
    };
  };

  const categories: ContinuityCategoryScore[] = [
    makeCat(
      'documentation',
      'Documentation Completeness',
      docPoints,
      25,
      `${documents.length} doc(s) uploaded · ${analysedDocs.length} analyzed`
    ),
    makeCat(
      'tasks',
      'Task Tracking Completeness',
      taskPoints,
      20,
      `${completedTasks.length} completed · ${pendingTasks.length} pending (${unassignedPendingTasks.length} unassigned)`
    ),
    makeCat(
      'decisions',
      'Decision Documentation',
      decisionPoints,
      20,
      `${decisions.length} decision(s) · ${approvedDecisions.length} human-verified`
    ),
    makeCat(
      'risks',
      'Risk & Blocker Management',
      riskPoints,
      20,
      `${risks.length} risk(s) · ${resolvedRisks.length} mitigated/resolved`
    ),
    makeCat(
      'handover',
      'Handover Readiness',
      handoverPoints,
      15,
      `${handovers.length} report(s) · ${publishedHandovers.length} approved`
    ),
  ];

  const totalScore = Math.max(
    0,
    Math.min(100, docPoints + taskPoints + decisionPoints + riskPoints + handoverPoints)
  );

  const readinessLevel: ProjectContinuityReport['readinessLevel'] =
    totalScore >= 80
      ? 'Handover Ready'
      : totalScore >= 60
      ? 'Moderate Continuity'
      : totalScore >= 35
      ? 'At Risk'
      : 'Critical Knowledge Loss Risk';

  for (const ded of deductions.slice(0, 5)) {
    recommendations.push(ded.recommendation);
  }

  // Pre-generation handover readiness checklist
  const warnings: string[] = [];
  if (documents.length === 0) {
    warnings.push('No project documents have been uploaded yet.');
  }
  if (!knowledge) {
    warnings.push('AI Knowledge Reconstruction has not been executed on the document corpus.');
  }
  if (unassignedPendingTasks.length > 0) {
    warnings.push(
      `${unassignedPendingTasks.length} pending task(s) do not have a verified owner assigned.`
    );
  }
  if (decisions.length === 0) {
    warnings.push('No architectural or technical decisions are documented.');
  }
  if (criticalOrHighRisks.some((r) => r.reviewStatus !== 'approved')) {
    warnings.push('One or more critical/high project risks have not been marked as mitigated/approved.');
  }

  return {
    totalScore,
    readinessLevel,
    categories,
    deductions,
    recommendations,
    detectedGaps,
    handoverChecklist: {
      hasProjectMetadata: Boolean(
        project?.name && project?.departingMember && project?.incomingMember
      ),
      hasUploadedDocs: documents.length > 0,
      hasAnalyzedDocs: analysedDocs.length > 0 && Boolean(knowledge),
      hasAssignedPendingTasks: tasks.length > 0 && unassignedPendingTasks.length === 0,
      hasVerifiedDecisions: approvedDecisions.length > 0,
      hasMitigatedCriticalRisks:
        criticalOrHighRisks.length === 0 ||
        criticalOrHighRisks.every((r) => r.reviewStatus === 'approved'),
      isReadyForFinalHandover: warnings.length === 0,
      warnings,
    },
  };
}
