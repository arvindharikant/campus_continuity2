import { Timestamp } from 'firebase/firestore';

export type ProjectStatus = 'active' | 'handover_in_progress' | 'review_pending' | 'completed' | 'archived';
export type HandoverRole = 'departing' | 'incoming' | 'reviewer' | 'stakeholder';
export type DocumentFileType = 'pdf' | 'docx' | 'txt' | 'md';
export type AnalysisStatus = 'uploaded' | 'analysed' | 'error';
export type EvidenceType = 'verified' | 'inferred';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type TaskStatus = 'completed' | 'in_progress' | 'pending' | 'blocked';
export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';
export type DependencyType = 'technical' | 'vendor' | 'team' | 'regulatory' | 'infrastructure';
export type DependencyStatus = 'active' | 'at_risk' | 'blocked' | 'resolved';
export type HandoverTargetRole = 'all' | 'engineering' | 'product' | 'operations' | 'executive';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  jobTitle: string;
  department: string;
  notifyOnReview: boolean;
  notifyOnHandover: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  code: string;
  description: string;
  status: ProjectStatus;
  department: string;
  departingMember: string;
  departingRole: string;
  incomingMember: string;
  incomingRole: string;
  targetHandoverDate: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ProjectMember {
  id: string;
  ownerId: string;
  projectId: string;
  memberName: string;
  memberEmail: string;
  role: string;
  handoverRole: HandoverRole;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ProjectDocument {
  id: string;
  ownerId: string;
  projectId: string;
  fileName: string;
  fileType: DocumentFileType;
  fileSize: number;
  extractedText: string;
  pageCount: number;
  analysisStatus: AnalysisStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface TimelineEvent {
  dateOrPeriod: string;
  eventTitle: string;
  status: string;
  sourceDocumentName: string;
  evidenceNote: string;
}

export interface ContradictionItem {
  topic: string;
  conflictDescription: string;
  sourceA: string;
  sourceB: string;
  resolutionRecommendation: string;
}

export interface MissingInfoItem {
  missingItem: string;
  impact: string;
  whoToAsk: string;
}

export interface UnresolvedQuestionItem {
  question: string;
  context: string;
  sourceDocumentName: string;
}

export interface NextActionItem {
  action: string;
  priority: string;
  rationale: string;
}

export interface ExtractedKnowledge {
  id: string;
  ownerId: string;
  projectId: string;
  executiveSummary: string;
  completedWorkSummary: string;
  timelineEvents: string; // JSON stringified TimelineEvent[]
  contradictions: string; // JSON stringified ContradictionItem[]
  missingInformation: string; // JSON stringified MissingInfoItem[]
  unresolvedQuestions: string; // JSON stringified UnresolvedQuestionItem[]
  recommendedNextActions: string; // JSON stringified NextActionItem[]
  confidenceScore: number;
  sourceDocumentCount: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Decision {
  id: string;
  ownerId: string;
  projectId: string;
  title: string;
  description: string;
  rationale: string;
  decisionMaker: string;
  decisionDate: string;
  evidenceType: EvidenceType;
  confidence: ConfidenceLevel;
  sourceDocumentName: string;
  sourceQuote: string;
  reviewStatus: ReviewStatus;
  reviewerComment: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface TaskItem {
  id: string;
  ownerId: string;
  projectId: string;
  title: string;
  description: string;
  taskStatus: TaskStatus;
  priority: PriorityLevel;
  assignedOwner: string;
  evidenceType: EvidenceType;
  confidence: ConfidenceLevel;
  sourceDocumentName: string;
  sourceQuote: string;
  reviewStatus: ReviewStatus;
  reviewerComment: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface RiskItem {
  id: string;
  ownerId: string;
  projectId: string;
  title: string;
  description: string;
  severity: PriorityLevel;
  mitigationPlan: string;
  evidenceType: EvidenceType;
  confidence: ConfidenceLevel;
  sourceDocumentName: string;
  sourceQuote: string;
  reviewStatus: ReviewStatus;
  reviewerComment: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface DependencyItem {
  id: string;
  ownerId: string;
  projectId: string;
  name: string;
  description: string;
  dependencyType: DependencyType;
  status: DependencyStatus;
  ownerContact: string;
  sourceDocumentName: string;
  sourceQuote: string;
  reviewStatus: ReviewStatus;
  reviewerComment: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ReviewLog {
  id: string;
  ownerId: string;
  projectId: string;
  findingId: string;
  findingCategory: 'decision' | 'task' | 'risk' | 'dependency';
  findingTitle: string;
  previousStatus: ReviewStatus;
  newStatus: ReviewStatus;
  comment: string;
  reviewerName: string;
  createdAt?: Timestamp;
}

export interface HandoverReport {
  id: string;
  ownerId: string;
  projectId: string;
  title: string;
  targetRole: HandoverTargetRole;
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
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ActivityLog {
  id: string;
  ownerId: string;
  projectId: string;
  projectName: string;
  actionType:
    | 'project_created'
    | 'project_updated'
    | 'document_uploaded'
    | 'ai_analysis_completed'
    | 'finding_reviewed'
    | 'handover_generated';
  summary: string;
  actorName: string;
  createdAt?: Timestamp;
}
