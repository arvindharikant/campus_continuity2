import { auth } from '../firebase';
import {
  Project,
  Decision,
  TaskItem,
  RiskItem,
  DependencyItem,
  HandoverTargetRole,
} from '../types/models';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication required. Please sign in.');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function extractDocumentTextViaBackend(payload: {
  fileName: string;
  fileType: 'pdf' | 'docx' | 'txt' | 'md';
  fileSize: number;
  base64Data?: string;
  rawText?: string;
}): Promise<{
  fileName: string;
  fileType: 'pdf' | 'docx' | 'txt' | 'md';
  extractedText: string;
  pageCount: number;
}> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/documents/extract', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.details || data.error || 'Failed to extract text from document.');
  }
  return data;
}

export async function runGeminiKnowledgeReconstruction(payload: {
  projectName: string;
  projectDescription: string;
  departingMember: string;
  incomingMember: string;
  documents: Array<{
    fileName: string;
    fileType: string;
    extractedText: string;
  }>;
}) {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/ai/reconstruct', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.details || data.error || 'Failed to run Gemini knowledge reconstruction.');
  }
  return data.reconstruction;
}

export async function synthesizeRoleHandoverViaBackend(payload: {
  project: Project;
  targetRole: HandoverTargetRole;
  recipientName: string;
  knowledge: Record<string, unknown> | null;
  decisions: Decision[];
  tasks: TaskItem[];
  risks: RiskItem[];
  dependencies: DependencyItem[];
}) {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/handover/synthesize', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.details || data.error || 'Failed to synthesize handover report.');
  }
  return data.report as {
    title: string;
    overviewSection: string;
    completedWorkSection: string;
    pendingWorkSection: string;
    decisionsSection: string;
    risksDependenciesSection: string;
    unresolvedIssuesSection: string;
    nextActionsSection: string;
  };
}

export interface AssistantCitation {
  sourceDocumentName: string;
  quote: string;
  findingCategory: string;
}

export interface AssistantReply {
  answer: string;
  evidenceStatus: 'verified' | 'partially_inferred' | 'insufficient_evidence' | string;
  citations: AssistantCitation[];
  followUpPrompts: string[];
}

export async function askProjectAssistantViaBackend(payload: {
  question: string;
  project: Project | null;
  documents: Array<{ fileName: string; extractedText: string }>;
  knowledge: unknown;
  decisions: Decision[];
  tasks: TaskItem[];
  risks: RiskItem[];
  dependencies: DependencyItem[];
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<AssistantReply> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/ai/assistant', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.details || data.error || 'Failed to query AI Assistant.');
  }
  return data.reply as AssistantReply;
}

