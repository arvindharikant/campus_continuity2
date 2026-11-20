import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import {
  UserProfile,
  Project,
  ProjectMember,
  ProjectDocument,
  Decision,
  TaskItem,
  RiskItem,
  DependencyItem,
  ReviewStatus,
  HandoverReport,
  ActivityLog,
} from '../types/models';

const clampStr = (val: unknown, max: number, fallback = ''): string => {
  const raw = typeof val === 'string' ? val.trim() : '';
  const s = raw.length > 0 ? raw : fallback;
  return s.slice(0, max);
};

const makeId = (prefix: string): string => {
  const rand = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
};

// ---------------------------------------------------------------------------
// 1. User Profile Service
// ---------------------------------------------------------------------------
export async function ensureUserProfile(
  uid: string,
  email: string,
  displayName: string,
  jobTitle = 'Senior Systems Engineer',
  department = 'Platform Engineering'
): Promise<UserProfile> {
  const path = `users/${uid}`;
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    const newProfile = {
      uid: clampStr(uid, 128),
      email: clampStr(email || 'user@enterprise.example', 256),
      displayName: clampStr(displayName || email.split('@')[0] || 'Platform User', 120, 'Platform User'),
      jobTitle: clampStr(jobTitle, 120, 'Systems Engineer'),
      department: clampStr(department, 120, 'Engineering'),
      notifyOnReview: true,
      notifyOnHandover: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, newProfile);
    return {
      ...newProfile,
      createdAt: undefined,
      updatedAt: undefined,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserProfile(
  uid: string,
  updates: {
    displayName: string;
    jobTitle: string;
    department: string;
    notifyOnReview: boolean;
    notifyOnHandover: boolean;
  }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: clampStr(updates.displayName, 120, 'User'),
      jobTitle: clampStr(updates.jobTitle, 120),
      department: clampStr(updates.department, 120),
      notifyOnReview: Boolean(updates.notifyOnReview),
      notifyOnHandover: Boolean(updates.notifyOnHandover),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ---------------------------------------------------------------------------
// 2. Activity Log Helper
// ---------------------------------------------------------------------------
export async function logProjectActivity(
  projectId: string,
  projectName: string,
  actionType: ActivityLog['actionType'],
  summary: string,
  actorName?: string
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const logId = makeId('log');
  const path = `activityLogs/${logId}`;
  try {
    await setDoc(doc(db, 'activityLogs', logId), {
      ownerId: uid,
      projectId: clampStr(projectId, 128),
      projectName: clampStr(projectName, 140, 'Project'),
      actionType,
      summary: clampStr(summary, 500, 'Activity recorded'),
      actorName: clampStr(
        actorName || auth.currentUser?.displayName || auth.currentUser?.email || 'Authorised User',
        120
      ),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// ---------------------------------------------------------------------------
// 3. Project CRUD Service
// ---------------------------------------------------------------------------
export async function createProjectRecord(input: {
  name: string;
  code: string;
  description: string;
  status: Project['status'];
  department: string;
  departingMember: string;
  departingRole: string;
  incomingMember: string;
  incomingRole: string;
  targetHandoverDate: string;
}): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('User must be signed in to create a project.');
  const projectId = makeId('proj');
  const path = `projects/${projectId}`;

  try {
    await setDoc(doc(db, 'projects', projectId), {
      ownerId: uid,
      name: clampStr(input.name, 140, 'Untitled Project'),
      code: clampStr(input.code, 32, 'PRJ-01'),
      description: clampStr(input.description, 2000),
      status: input.status || 'handover_in_progress',
      department: clampStr(input.department, 100, 'Engineering'),
      departingMember: clampStr(input.departingMember, 120),
      departingRole: clampStr(input.departingRole, 120),
      incomingMember: clampStr(input.incomingMember, 120),
      incomingRole: clampStr(input.incomingRole, 120),
      targetHandoverDate: clampStr(input.targetHandoverDate, 40),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await logProjectActivity(
      projectId,
      input.name,
      'project_created',
      `Created project workspace "${input.name}" (${input.code}) for handover from ${input.departingMember || 'Departing Lead'} to ${input.incomingMember || 'Incoming Lead'}.`
    );

    return projectId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateProjectRecord(
  projectId: string,
  updates: {
    name: string;
    code: string;
    description: string;
    status: Project['status'];
    department: string;
    departingMember: string;
    departingRole: string;
    incomingMember: string;
    incomingRole: string;
    targetHandoverDate: string;
  }
): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId), {
      name: clampStr(updates.name, 140, 'Untitled Project'),
      code: clampStr(updates.code, 32, 'PRJ-01'),
      description: clampStr(updates.description, 2000),
      status: updates.status,
      department: clampStr(updates.department, 100),
      departingMember: clampStr(updates.departingMember, 120),
      departingRole: clampStr(updates.departingRole, 120),
      incomingMember: clampStr(updates.incomingMember, 120),
      incomingRole: clampStr(updates.incomingRole, 120),
      targetHandoverDate: clampStr(updates.targetHandoverDate, 40),
      updatedAt: serverTimestamp(),
    });

    await logProjectActivity(
      projectId,
      updates.name,
      'project_updated',
      `Updated project configuration and status (${updates.status.replace(/_/g, ' ')}).`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteProjectCascade(projectId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const childCollections = [
    'projectMembers',
    'documents',
    'extractedKnowledge',
    'decisions',
    'tasks',
    'risks',
    'dependencies',
    'reviews',
    'handovers',
    'activityLogs',
  ];

  try {
    for (const colName of childCollections) {
      const q = query(
        collection(db, colName),
        where('ownerId', '==', uid),
        where('projectId', '==', projectId)
      );
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(doc(db, colName, d.id));
      }
    }
    await deleteDoc(doc(db, 'projects', projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `projects/${projectId}`);
  }
}

// ---------------------------------------------------------------------------
// 4. Project Members Service
// ---------------------------------------------------------------------------
export async function addProjectMemberRecord(input: {
  projectId: string;
  memberName: string;
  memberEmail: string;
  role: string;
  handoverRole: ProjectMember['handoverRole'];
}): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  const memberId = makeId('mem');
  const path = `projectMembers/${memberId}`;

  try {
    await setDoc(doc(db, 'projectMembers', memberId), {
      ownerId: uid,
      projectId: clampStr(input.projectId, 128),
      memberName: clampStr(input.memberName, 120, 'Team Member'),
      memberEmail: clampStr(input.memberEmail, 256, 'member@enterprise.example'),
      role: clampStr(input.role, 100, 'Contributor'),
      handoverRole: input.handoverRole,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return memberId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeProjectMemberRecord(memberId: string): Promise<void> {
  const path = `projectMembers/${memberId}`;
  try {
    await deleteDoc(doc(db, 'projectMembers', memberId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// 5. Document Management Service
// ---------------------------------------------------------------------------
export async function saveExtractedDocumentRecord(input: {
  projectId: string;
  projectName: string;
  fileName: string;
  fileType: ProjectDocument['fileType'];
  fileSize: number;
  extractedText: string;
  pageCount: number;
}): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  const docId = makeId('doc');
  const path = `documents/${docId}`;

  try {
    await setDoc(doc(db, 'documents', docId), {
      ownerId: uid,
      projectId: clampStr(input.projectId, 128),
      fileName: clampStr(input.fileName, 240, 'Document.txt'),
      fileType: input.fileType,
      fileSize: Math.max(0, Math.min(25000000, Number(input.fileSize) || 1024)),
      extractedText: clampStr(input.extractedText, 150000),
      pageCount: Math.max(1, Math.min(5000, Number(input.pageCount) || 1)),
      analysisStatus: 'uploaded',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await logProjectActivity(
      input.projectId,
      input.projectName,
      'document_uploaded',
      `Uploaded and extracted text from "${input.fileName}" (${input.pageCount} page${input.pageCount === 1 ? '' : 's'}).`
    );

    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteDocumentRecord(documentId: string): Promise<void> {
  const path = `documents/${documentId}`;
  try {
    await deleteDoc(doc(db, 'documents', documentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// 6. Save AI Knowledge Reconstruction Results
// ---------------------------------------------------------------------------
export async function saveAiReconstructionToFirestore(
  projectId: string,
  projectName: string,
  documentIds: string[],
  reconstruction: {
    executiveSummary?: string;
    completedWorkSummary?: string;
    confidenceScore?: number;
    timelineEvents?: unknown[];
    contradictions?: unknown[];
    missingInformation?: unknown[];
    unresolvedQuestions?: unknown[];
    recommendedNextActions?: unknown[];
    decisions?: Array<{
      title?: string;
      description?: string;
      rationale?: string;
      decisionMaker?: string;
      decisionDate?: string;
      evidenceType?: string;
      confidence?: string;
      sourceDocumentName?: string;
      sourceQuote?: string;
    }>;
    tasks?: Array<{
      title?: string;
      description?: string;
      taskStatus?: string;
      priority?: string;
      assignedOwner?: string;
      evidenceType?: string;
      confidence?: string;
      sourceDocumentName?: string;
      sourceQuote?: string;
    }>;
    risks?: Array<{
      title?: string;
      description?: string;
      severity?: string;
      mitigationPlan?: string;
      evidenceType?: string;
      confidence?: string;
      sourceDocumentName?: string;
      sourceQuote?: string;
    }>;
    dependencies?: Array<{
      name?: string;
      description?: string;
      dependencyType?: string;
      status?: string;
      ownerContact?: string;
      sourceDocumentName?: string;
      sourceQuote?: string;
    }>;
  }
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');

  const validEvidence = (v?: string): 'verified' | 'inferred' =>
    v === 'verified' ? 'verified' : 'inferred';
  const validConfidence = (v?: string): 'high' | 'medium' | 'low' =>
    v === 'high' || v === 'medium' || v === 'low' ? v : 'medium';
  const validPriority = (v?: string): 'critical' | 'high' | 'medium' | 'low' =>
    v === 'critical' || v === 'high' || v === 'medium' || v === 'low' ? v : 'medium';
  const validTaskStatus = (v?: string): 'completed' | 'in_progress' | 'pending' | 'blocked' =>
    v === 'completed' || v === 'in_progress' || v === 'pending' || v === 'blocked' ? v : 'pending';
  const validDepType = (
    v?: string
  ): 'technical' | 'vendor' | 'team' | 'regulatory' | 'infrastructure' =>
    v === 'technical' ||
    v === 'vendor' ||
    v === 'team' ||
    v === 'regulatory' ||
    v === 'infrastructure'
      ? v
      : 'technical';
  const validDepStatus = (v?: string): 'active' | 'at_risk' | 'blocked' | 'resolved' =>
    v === 'active' || v === 'at_risk' || v === 'blocked' || v === 'resolved' ? v : 'active';

  try {
    // Clear previous extracted records for this project so re-runs are clean
    const collectionsToClear = [
      'extractedKnowledge',
      'decisions',
      'tasks',
      'risks',
      'dependencies',
    ];
    for (const colName of collectionsToClear) {
      const q = query(
        collection(db, colName),
        where('ownerId', '==', uid),
        where('projectId', '==', projectId)
      );
      const snap = await getDocs(q);
      for (const existingDoc of snap.docs) {
        await deleteDoc(doc(db, colName, existingDoc.id));
      }
    }

    const batch = writeBatch(db);

    // 1. Save master ExtractedKnowledge document
    const knowledgeId = `know_${projectId}`;
    batch.set(doc(db, 'extractedKnowledge', knowledgeId), {
      ownerId: uid,
      projectId: clampStr(projectId, 128),
      executiveSummary: clampStr(reconstruction.executiveSummary, 5000, 'No summary extracted.'),
      completedWorkSummary: clampStr(
        reconstruction.completedWorkSummary,
        5000,
        'No completed work verified yet.'
      ),
      timelineEvents: clampStr(JSON.stringify(reconstruction.timelineEvents || []), 10000, '[]'),
      contradictions: clampStr(JSON.stringify(reconstruction.contradictions || []), 10000, '[]'),
      missingInformation: clampStr(
        JSON.stringify(reconstruction.missingInformation || []),
        10000,
        '[]'
      ),
      unresolvedQuestions: clampStr(
        JSON.stringify(reconstruction.unresolvedQuestions || []),
        10000,
        '[]'
      ),
      recommendedNextActions: clampStr(
        JSON.stringify(reconstruction.recommendedNextActions || []),
        10000,
        '[]'
      ),
      confidenceScore: Math.max(
        0,
        Math.min(100, Math.round(Number(reconstruction.confidenceScore) || 75))
      ),
      sourceDocumentCount: documentIds.length,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 2. Save Decisions
    for (const d of reconstruction.decisions || []) {
      const decId = makeId('dec');
      batch.set(doc(db, 'decisions', decId), {
        ownerId: uid,
        projectId: clampStr(projectId, 128),
        title: clampStr(d.title, 300, 'Extracted Decision'),
        description: clampStr(d.description, 3000),
        rationale: clampStr(d.rationale, 2000),
        decisionMaker: clampStr(d.decisionMaker, 160, 'Unassigned (Not stated in source)'),
        decisionDate: clampStr(d.decisionDate, 80, 'Unspecified'),
        evidenceType: validEvidence(d.evidenceType),
        confidence: validConfidence(d.confidence),
        sourceDocumentName: clampStr(d.sourceDocumentName, 240, 'Project Document'),
        sourceQuote: clampStr(d.sourceQuote, 1500),
        reviewStatus: 'pending',
        reviewerComment: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 3. Save Tasks
    for (const t of reconstruction.tasks || []) {
      const taskId = makeId('task');
      batch.set(doc(db, 'tasks', taskId), {
        ownerId: uid,
        projectId: clampStr(projectId, 128),
        title: clampStr(t.title, 300, 'Extracted Task'),
        description: clampStr(t.description, 3000),
        taskStatus: validTaskStatus(t.taskStatus),
        priority: validPriority(t.priority),
        assignedOwner: clampStr(t.assignedOwner, 160, 'Unassigned (Not stated in source)'),
        evidenceType: validEvidence(t.evidenceType),
        confidence: validConfidence(t.confidence),
        sourceDocumentName: clampStr(t.sourceDocumentName, 240, 'Project Document'),
        sourceQuote: clampStr(t.sourceQuote, 1500),
        reviewStatus: 'pending',
        reviewerComment: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 4. Save Risks
    for (const r of reconstruction.risks || []) {
      const riskId = makeId('risk');
      batch.set(doc(db, 'risks', riskId), {
        ownerId: uid,
        projectId: clampStr(projectId, 128),
        title: clampStr(r.title, 300, 'Extracted Risk'),
        description: clampStr(r.description, 3000),
        severity: validPriority(r.severity),
        mitigationPlan: clampStr(r.mitigationPlan, 2000),
        evidenceType: validEvidence(r.evidenceType),
        confidence: validConfidence(r.confidence),
        sourceDocumentName: clampStr(r.sourceDocumentName, 240, 'Project Document'),
        sourceQuote: clampStr(r.sourceQuote, 1500),
        reviewStatus: 'pending',
        reviewerComment: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 5. Save Dependencies
    for (const dep of reconstruction.dependencies || []) {
      const depId = makeId('dep');
      batch.set(doc(db, 'dependencies', depId), {
        ownerId: uid,
        projectId: clampStr(projectId, 128),
        name: clampStr(dep.name, 300, 'Extracted Dependency'),
        description: clampStr(dep.description, 2000),
        dependencyType: validDepType(dep.dependencyType),
        status: validDepStatus(dep.status),
        ownerContact: clampStr(dep.ownerContact, 160, 'Not specified in source'),
        sourceDocumentName: clampStr(dep.sourceDocumentName, 240, 'Project Document'),
        sourceQuote: clampStr(dep.sourceQuote, 1500),
        reviewStatus: 'pending',
        reviewerComment: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();

    // Update each document status to 'analysed'
    for (const docId of documentIds) {
      const dRef = doc(db, 'documents', docId);
      const dSnap = await getDoc(dRef);
      if (dSnap.exists()) {
        const dData = dSnap.data();
        await updateDoc(dRef, {
          analysisStatus: 'analysed',
          extractedText: dData.extractedText,
          pageCount: dData.pageCount,
          updatedAt: serverTimestamp(),
        });
      }
    }

    await logProjectActivity(
      projectId,
      projectName,
      'ai_analysis_completed',
      `Completed Gemini AI knowledge reconstruction: ${(reconstruction.decisions || []).length} decisions, ${(reconstruction.tasks || []).length} tasks, ${(reconstruction.risks || []).length} risks, and ${(reconstruction.dependencies || []).length} dependencies extracted with source evidence.`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `extractedKnowledge/know_${projectId}`);
  }
}

// ---------------------------------------------------------------------------
// 7. Review & Approval Service (with Revision History in /reviews)
// ---------------------------------------------------------------------------
export async function reviewFindingRecord(input: {
  projectId: string;
  projectName: string;
  category: 'decision' | 'task' | 'risk' | 'dependency';
  findingId: string;
  findingTitle: string;
  previousStatus: ReviewStatus;
  newStatus: ReviewStatus;
  comment: string;
  reviewerName: string;
  updatedFields?: Record<string, unknown>;
}): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');

  const collectionMap = {
    decision: 'decisions',
    task: 'tasks',
    risk: 'risks',
    dependency: 'dependencies',
  } as const;

  const colName = collectionMap[input.category];
  const itemPath = `${colName}/${input.findingId}`;

  try {
    const itemRef = doc(db, colName, input.findingId);
    const snap = await getDoc(itemRef);
    if (!snap.exists()) throw new Error('Finding record not found.');
    const current = snap.data();

    if (input.category === 'decision') {
      const u = (input.updatedFields || {}) as Partial<Decision>;
      await updateDoc(itemRef, {
        title: clampStr(u.title ?? current.title, 300, 'Decision'),
        description: clampStr(u.description ?? current.description, 3000),
        rationale: clampStr(u.rationale ?? current.rationale, 2000),
        decisionMaker: clampStr(u.decisionMaker ?? current.decisionMaker, 160),
        decisionDate: clampStr(u.decisionDate ?? current.decisionDate, 80),
        evidenceType: u.evidenceType ?? current.evidenceType,
        confidence: u.confidence ?? current.confidence,
        reviewStatus: input.newStatus,
        reviewerComment: clampStr(input.comment, 1000),
        updatedAt: serverTimestamp(),
      });
    } else if (input.category === 'task') {
      const u = (input.updatedFields || {}) as Partial<TaskItem>;
      await updateDoc(itemRef, {
        title: clampStr(u.title ?? current.title, 300, 'Task'),
        description: clampStr(u.description ?? current.description, 3000),
        taskStatus: u.taskStatus ?? current.taskStatus,
        priority: u.priority ?? current.priority,
        assignedOwner: clampStr(u.assignedOwner ?? current.assignedOwner, 160),
        evidenceType: u.evidenceType ?? current.evidenceType,
        confidence: u.confidence ?? current.confidence,
        reviewStatus: input.newStatus,
        reviewerComment: clampStr(input.comment, 1000),
        updatedAt: serverTimestamp(),
      });
    } else if (input.category === 'risk') {
      const u = (input.updatedFields || {}) as Partial<RiskItem>;
      await updateDoc(itemRef, {
        title: clampStr(u.title ?? current.title, 300, 'Risk'),
        description: clampStr(u.description ?? current.description, 3000),
        severity: u.severity ?? current.severity,
        mitigationPlan: clampStr(u.mitigationPlan ?? current.mitigationPlan, 2000),
        evidenceType: u.evidenceType ?? current.evidenceType,
        confidence: u.confidence ?? current.confidence,
        reviewStatus: input.newStatus,
        reviewerComment: clampStr(input.comment, 1000),
        updatedAt: serverTimestamp(),
      });
    } else if (input.category === 'dependency') {
      const u = (input.updatedFields || {}) as Partial<DependencyItem>;
      await updateDoc(itemRef, {
        name: clampStr(u.name ?? current.name, 300, 'Dependency'),
        description: clampStr(u.description ?? current.description, 2000),
        dependencyType: u.dependencyType ?? current.dependencyType,
        status: u.status ?? current.status,
        ownerContact: clampStr(u.ownerContact ?? current.ownerContact, 160),
        reviewStatus: input.newStatus,
        reviewerComment: clampStr(input.comment, 1000),
        updatedAt: serverTimestamp(),
      });
    }

    // Record immutable revision log in /reviews
    const reviewId = makeId('rev');
    await setDoc(doc(db, 'reviews', reviewId), {
      ownerId: uid,
      projectId: clampStr(input.projectId, 128),
      findingId: clampStr(input.findingId, 128),
      findingCategory: input.category,
      findingTitle: clampStr(input.findingTitle, 300, 'Finding'),
      previousStatus: input.previousStatus,
      newStatus: input.newStatus,
      comment: clampStr(input.comment, 1000),
      reviewerName: clampStr(input.reviewerName, 120, 'Reviewer'),
      createdAt: serverTimestamp(),
    });

    await logProjectActivity(
      input.projectId,
      input.projectName,
      'finding_reviewed',
      `Reviewed ${input.category} "${input.findingTitle}": marked as ${input.newStatus.toUpperCase()}.`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, itemPath);
  }
}

// ---------------------------------------------------------------------------
// 8. Handover Report CRUD Service
// ---------------------------------------------------------------------------
export async function createHandoverReportRecord(input: {
  projectId: string;
  projectName: string;
  title: string;
  targetRole: HandoverReport['targetRole'];
  recipientName: string;
  overviewSection: string;
  completedWorkSection: string;
  pendingWorkSection: string;
  decisionsSection: string;
  risksDependenciesSection: string;
  unresolvedIssuesSection: string;
  nextActionsSection: string;
  shareStatus: 'draft' | 'published';
  sharedWithEmails: string;
}): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  const handoverId = makeId('hnd');
  const path = `handovers/${handoverId}`;

  try {
    await setDoc(doc(db, 'handovers', handoverId), {
      ownerId: uid,
      projectId: clampStr(input.projectId, 128),
      title: clampStr(input.title, 240, 'Handover Package'),
      targetRole: input.targetRole,
      recipientName: clampStr(input.recipientName, 120, 'Incoming Team Member'),
      overviewSection: clampStr(input.overviewSection, 8000),
      completedWorkSection: clampStr(input.completedWorkSection, 8000),
      pendingWorkSection: clampStr(input.pendingWorkSection, 8000),
      decisionsSection: clampStr(input.decisionsSection, 8000),
      risksDependenciesSection: clampStr(input.risksDependenciesSection, 8000),
      unresolvedIssuesSection: clampStr(input.unresolvedIssuesSection, 8000),
      nextActionsSection: clampStr(input.nextActionsSection, 8000),
      shareStatus: input.shareStatus,
      sharedWithEmails: clampStr(input.sharedWithEmails, 1000),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await logProjectActivity(
      input.projectId,
      input.projectName,
      'handover_generated',
      `Generated structured handover report "${input.title}" (Role view: ${input.targetRole}).`
    );

    return handoverId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateHandoverReportRecord(
  handoverId: string,
  updates: {
    title: string;
    targetRole: HandoverReport['targetRole'];
    recipientName: string;
    overviewSection: string;
    completedWorkSection: string;
    pendingWorkSection: string;
    decisionsSection: string;
    risksDependenciesSection: string;
    unresolvedIssuesSection: string;
    nextActionsSection: string;
    shareStatus: 'draft' | 'published';
    sharedWithEmails: string;
  }
): Promise<void> {
  const path = `handovers/${handoverId}`;
  try {
    await updateDoc(doc(db, 'handovers', handoverId), {
      title: clampStr(updates.title, 240, 'Handover Package'),
      targetRole: updates.targetRole,
      recipientName: clampStr(updates.recipientName, 120),
      overviewSection: clampStr(updates.overviewSection, 8000),
      completedWorkSection: clampStr(updates.completedWorkSection, 8000),
      pendingWorkSection: clampStr(updates.pendingWorkSection, 8000),
      decisionsSection: clampStr(updates.decisionsSection, 8000),
      risksDependenciesSection: clampStr(updates.risksDependenciesSection, 8000),
      unresolvedIssuesSection: clampStr(updates.unresolvedIssuesSection, 8000),
      nextActionsSection: clampStr(updates.nextActionsSection, 8000),
      shareStatus: updates.shareStatus,
      sharedWithEmails: clampStr(updates.sharedWithEmails, 1000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteHandoverReportRecord(handoverId: string): Promise<void> {
  const path = `handovers/${handoverId}`;
  try {
    await deleteDoc(doc(db, 'handovers', handoverId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// 9. Manual Task, Decision & Risk Creation Helpers (Campus Continuity Feature 2 & 6)
// ---------------------------------------------------------------------------
export async function createManualTaskRecord(input: {
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  taskStatus: TaskItem['taskStatus'];
  priority: TaskItem['priority'];
  assignedOwner: string;
  sourceDocumentName?: string;
  sourceQuote?: string;
}): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('User must be signed in to add a task.');
  const taskId = makeId('task');
  const path = `tasks/${taskId}`;

  try {
    await setDoc(doc(db, 'tasks', taskId), {
      ownerId: uid,
      projectId: clampStr(input.projectId, 128),
      title: clampStr(input.title, 300, 'New Project Task'),
      description: clampStr(input.description, 3000, 'Manually recorded project task.'),
      taskStatus: input.taskStatus || 'pending',
      priority: input.priority || 'medium',
      assignedOwner: clampStr(input.assignedOwner, 160, 'Unassigned'),
      evidenceType: 'verified',
      confidence: 'high',
      sourceDocumentName: clampStr(
        input.sourceDocumentName,
        240,
        'Manual Team Entry (Human Verified)'
      ),
      sourceQuote: clampStr(
        input.sourceQuote || input.description,
        1500,
        'Directly recorded and verified by project team member.'
      ),
      reviewStatus: 'approved',
      reviewerComment: 'Manually added and verified by project contributor.',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await logProjectActivity(
      input.projectId,
      input.projectName,
      'finding_reviewed',
      `Added manual task "${input.title}" (${input.taskStatus.toUpperCase()}) assigned to ${input.assignedOwner || 'Unassigned'}.`
    );

    return taskId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createManualDecisionRecord(input: {
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  rationale: string;
  decisionMaker: string;
  decisionDate: string;
  sourceDocumentName?: string;
  sourceQuote?: string;
}): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('User must be signed in to add a decision.');
  const decId = makeId('dec');
  const path = `decisions/${decId}`;

  try {
    await setDoc(doc(db, 'decisions', decId), {
      ownerId: uid,
      projectId: clampStr(input.projectId, 128),
      title: clampStr(input.title, 300, 'Technical Decision'),
      description: clampStr(input.description, 3000, 'Manually recorded technical decision.'),
      rationale: clampStr(input.rationale, 2000, 'Documented by project team.'),
      decisionMaker: clampStr(input.decisionMaker, 160, 'Project Team'),
      decisionDate: clampStr(input.decisionDate, 80, new Date().toISOString().slice(0, 10)),
      evidenceType: 'verified',
      confidence: 'high',
      sourceDocumentName: clampStr(
        input.sourceDocumentName,
        240,
        'Manual Architecture Entry (Human Verified)'
      ),
      sourceQuote: clampStr(
        input.sourceQuote || `${input.description} — Rationale: ${input.rationale}`,
        1500,
        'Directly documented by project team.'
      ),
      reviewStatus: 'approved',
      reviewerComment: 'Manually added and verified by project contributor.',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await logProjectActivity(
      input.projectId,
      input.projectName,
      'finding_reviewed',
      `Added manual technical decision "${input.title}" (Decision Maker: ${input.decisionMaker}).`
    );

    return decId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createManualRiskRecord(input: {
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  severity: RiskItem['severity'];
  mitigationPlan: string;
  sourceDocumentName?: string;
}): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('User must be signed in to add a risk.');
  const riskId = makeId('risk');
  const path = `risks/${riskId}`;

  try {
    await setDoc(doc(db, 'risks', riskId), {
      ownerId: uid,
      projectId: clampStr(input.projectId, 128),
      title: clampStr(input.title, 300, 'Identified Project Risk'),
      description: clampStr(input.description, 3000, 'Manually logged risk or knowledge gap.'),
      severity: input.severity || 'high',
      mitigationPlan: clampStr(
        input.mitigationPlan,
        2000,
        'Assign owner and verify resolution before project handover.'
      ),
      evidenceType: 'verified',
      confidence: 'high',
      sourceDocumentName: clampStr(
        input.sourceDocumentName,
        240,
        'Manual Risk & Gap Register'
      ),
      sourceQuote: clampStr(input.description, 1500, 'Logged in project risk register.'),
      reviewStatus: 'pending',
      reviewerComment: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await logProjectActivity(
      input.projectId,
      input.projectName,
      'finding_reviewed',
      `Logged project risk "${input.title}" (Severity: ${input.severity.toUpperCase()}).`
    );

    return riskId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

