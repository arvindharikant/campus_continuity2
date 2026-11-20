import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  X,
  Edit3,
  History,
  ArrowRight,
  CheckCheck,
  BookOpen,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  reviewFindingRecord,
  createManualTaskRecord,
  createManualDecisionRecord,
} from '../services/firestoreService';
import {
  ReviewStatus,
  EvidenceType,
  ConfidenceLevel,
  TaskStatus,
  PriorityLevel,
} from '../types/models';

type ViewTab =
  | 'all_findings'
  | 'all_tasks'
  | 'completed_tasks'
  | 'pending_tasks'
  | 'decisions'
  | 'risks_deps';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

interface UnifiedFinding {
  id: string;
  category: 'decision' | 'task' | 'risk' | 'dependency';
  title: string;
  description: string;
  ownerOrContact: string;
  evidenceType: EvidenceType;
  confidence: ConfidenceLevel;
  sourceDocumentName: string;
  sourceQuote: string;
  reviewStatus: ReviewStatus;
  reviewerComment: string;
  extraMeta: string;
  taskStatus?: TaskStatus;
  priority?: PriorityLevel;
  rationale?: string;
  decisionDate?: string;
}

export default function KnowledgeReviewPage() {
  const navigate = useNavigate();
  const {
    user,
    userProfile,
    activeProject,
    projectDocuments,
    projectDecisions,
    projectTasks,
    projectRisks,
    projectDependencies,
    projectReviews,
  } = useAppContext();

  const [viewTab, setViewTab] = useState<ViewTab>('all_findings');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [editingItem, setEditingItem] = useState<UnifiedFinding | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editOwner, setEditOwner] = useState('');
  const [editTaskStatus, setEditTaskStatus] = useState<TaskStatus>('pending');
  const [editPriority, setEditPriority] = useState<PriorityLevel>('medium');
  const [editRationale, setEditRationale] = useState('');
  const [editComment, setEditComment] = useState('');

  // Manual Task Creation Modal State
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('pending');
  const [newTaskPriority, setNewTaskPriority] = useState<PriorityLevel>('high');
  const [newTaskOwner, setNewTaskOwner] = useState('');

  // Manual Decision Creation Modal State
  const [showAddDecisionModal, setShowAddDecisionModal] = useState(false);
  const [newDecTitle, setNewDecTitle] = useState('');
  const [newDecDesc, setNewDecDesc] = useState('');
  const [newDecRationale, setNewDecRationale] = useState('');
  const [newDecMaker, setNewDecMaker] = useState('');
  const [newDecDate, setNewDecDate] = useState(new Date().toISOString().slice(0, 10));

  const [sourceModalItem, setSourceModalItem] = useState<UnifiedFinding | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const reviewerName =
    userProfile?.displayName || user?.displayName || user?.email || 'Authorised Reviewer';

  const unifiedFindings: UnifiedFinding[] = [
    ...projectTasks.map((t) => ({
      id: t.id,
      category: 'task' as const,
      title: t.title,
      description: t.description,
      ownerOrContact: t.assignedOwner,
      evidenceType: t.evidenceType,
      confidence: t.confidence,
      sourceDocumentName: t.sourceDocumentName,
      sourceQuote: t.sourceQuote,
      reviewStatus: t.reviewStatus,
      reviewerComment: t.reviewerComment,
      extraMeta: `Task Status: ${t.taskStatus.toUpperCase()} · Priority: ${t.priority.toUpperCase()}`,
      taskStatus: t.taskStatus,
      priority: t.priority,
    })),
    ...projectDecisions.map((d) => ({
      id: d.id,
      category: 'decision' as const,
      title: d.title,
      description: d.description,
      ownerOrContact: d.decisionMaker,
      evidenceType: d.evidenceType,
      confidence: d.confidence,
      sourceDocumentName: d.sourceDocumentName,
      sourceQuote: d.sourceQuote,
      reviewStatus: d.reviewStatus,
      reviewerComment: d.reviewerComment,
      extraMeta: `Date: ${d.decisionDate} · Rationale: ${d.rationale}`,
      rationale: d.rationale,
      decisionDate: d.decisionDate,
    })),
    ...projectRisks.map((r) => ({
      id: r.id,
      category: 'risk' as const,
      title: r.title,
      description: r.description,
      ownerOrContact: `Severity: ${r.severity.toUpperCase()}`,
      evidenceType: r.evidenceType,
      confidence: r.confidence,
      sourceDocumentName: r.sourceDocumentName,
      sourceQuote: r.sourceQuote,
      reviewStatus: r.reviewStatus,
      reviewerComment: r.reviewerComment,
      extraMeta: `Mitigation: ${r.mitigationPlan}`,
    })),
    ...projectDependencies.map((dep) => ({
      id: dep.id,
      category: 'dependency' as const,
      title: dep.name,
      description: dep.description,
      ownerOrContact: dep.ownerContact,
      evidenceType: 'verified' as const,
      confidence: 'high' as const,
      sourceDocumentName: dep.sourceDocumentName,
      sourceQuote: dep.sourceQuote,
      reviewStatus: dep.reviewStatus,
      reviewerComment: dep.reviewerComment,
      extraMeta: `Type: ${dep.dependencyType.toUpperCase()} · Status: ${dep.status.toUpperCase()}`,
    })),
  ];

  const completedTasksCount = projectTasks.filter((t) => t.taskStatus === 'completed').length;
  const pendingTasksCount = projectTasks.filter((t) => t.taskStatus !== 'completed').length;

  const getVerificationLabel = (item: UnifiedFinding): 'Verified' | 'Inferred' | 'Uncertain' => {
    if (
      item.confidence === 'low' ||
      item.ownerOrContact.toLowerCase().includes('unassigned')
    ) {
      return 'Uncertain';
    }
    if (item.evidenceType === 'inferred') {
      return 'Inferred';
    }
    return 'Verified';
  };

  const filteredFindings = unifiedFindings.filter((item) => {
    if (viewTab === 'all_tasks' && item.category !== 'task') return false;
    if (
      viewTab === 'completed_tasks' &&
      (item.category !== 'task' || item.taskStatus !== 'completed')
    ) {
      return false;
    }
    if (
      viewTab === 'pending_tasks' &&
      (item.category !== 'task' || item.taskStatus === 'completed')
    ) {
      return false;
    }
    if (viewTab === 'decisions' && item.category !== 'decision') return false;
    if (
      viewTab === 'risks_deps' &&
      item.category !== 'risk' &&
      item.category !== 'dependency'
    ) {
      return false;
    }
    if (statusFilter !== 'all' && item.reviewStatus !== statusFilter) return false;
    return true;
  });

  const handleQuickDecision = async (
    item: UnifiedFinding,
    newStatus: ReviewStatus,
    commentText?: string
  ) => {
    if (!activeProject) return;
    setErrorMsg(null);
    setSubmittingId(item.id);
    try {
      await reviewFindingRecord({
        projectId: activeProject.id,
        projectName: activeProject.name,
        category: item.category,
        findingId: item.id,
        findingTitle: item.title,
        previousStatus: item.reviewStatus,
        newStatus,
        comment:
          commentText !== undefined
            ? commentText
            : item.reviewerComment || `Reviewed and marked ${newStatus} by ${reviewerName}.`,
        reviewerName,
      });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingId(null);
    }
  };

  const handleToggleTaskCompletion = async (item: UnifiedFinding) => {
    if (!activeProject || item.category !== 'task') return;
    const nextTaskStatus: TaskStatus =
      item.taskStatus === 'completed' ? 'pending' : 'completed';
    setErrorMsg(null);
    setSubmittingId(item.id);
    try {
      await reviewFindingRecord({
        projectId: activeProject.id,
        projectName: activeProject.name,
        category: 'task',
        findingId: item.id,
        findingTitle: item.title,
        previousStatus: item.reviewStatus,
        newStatus: 'approved',
        comment: `Task marked as ${nextTaskStatus.toUpperCase()} by ${reviewerName}.`,
        reviewerName,
        updatedFields: {
          taskStatus: nextTaskStatus,
        },
      });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingId(null);
    }
  };

  const handleBatchApproveVerifiedOnly = async () => {
    if (!activeProject) return;
    const verifiedPending = unifiedFindings.filter(
      (f) => f.reviewStatus === 'pending' && getVerificationLabel(f) === 'Verified'
    );
    if (verifiedPending.length === 0) return;

    setSubmittingId('batch');
    setErrorMsg(null);
    try {
      for (const item of verifiedPending) {
        await reviewFindingRecord({
          projectId: activeProject.id,
          projectName: activeProject.name,
          category: item.category,
          findingId: item.id,
          findingTitle: item.title,
          previousStatus: item.reviewStatus,
          newStatus: 'approved',
          comment: `Source-verified finding approved by ${reviewerName}.`,
          reviewerName,
        });
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingId(null);
    }
  };

  const openEditDrawer = (item: UnifiedFinding) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditDescription(item.description);
    setEditOwner(item.ownerOrContact);
    setEditTaskStatus(item.taskStatus || 'pending');
    setEditPriority(item.priority || 'medium');
    setEditRationale(item.rationale || '');
    setEditComment(item.reviewerComment || '');
  };

  const handleSaveEditAndApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !editingItem) return;
    setSubmittingId(editingItem.id);
    setErrorMsg(null);

    try {
      const updatedFields: Record<string, unknown> = {
        description: editDescription,
      };
      if (editingItem.category === 'dependency') {
        updatedFields.name = editTitle;
        updatedFields.ownerContact = editOwner;
      } else {
        updatedFields.title = editTitle;
        if (editingItem.category === 'decision') {
          updatedFields.decisionMaker = editOwner;
          updatedFields.rationale = editRationale;
        }
        if (editingItem.category === 'task') {
          updatedFields.assignedOwner = editOwner;
          updatedFields.taskStatus = editTaskStatus;
          updatedFields.priority = editPriority;
        }
      }

      await reviewFindingRecord({
        projectId: activeProject.id,
        projectName: activeProject.name,
        category: editingItem.category,
        findingId: editingItem.id,
        findingTitle: editTitle,
        previousStatus: editingItem.reviewStatus,
        newStatus: 'approved',
        comment: editComment || `Edited and verified by ${reviewerName}.`,
        reviewerName,
        updatedFields,
      });

      setEditingItem(null);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingId(null);
    }
  };

  const handleCreateManualTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !newTaskTitle.trim()) return;
    setSubmittingId('new-task');
    setErrorMsg(null);
    try {
      await createManualTaskRecord({
        projectId: activeProject.id,
        projectName: activeProject.name,
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim() || newTaskTitle.trim(),
        taskStatus: newTaskStatus,
        priority: newTaskPriority,
        assignedOwner:
          newTaskOwner.trim() ||
          activeProject.incomingMember ||
          'Unassigned',
      });
      setShowAddTaskModal(false);
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskOwner('');
      setViewTab(newTaskStatus === 'completed' ? 'completed_tasks' : 'pending_tasks');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingId(null);
    }
  };

  const handleCreateManualDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !newDecTitle.trim()) return;
    setSubmittingId('new-decision');
    setErrorMsg(null);
    try {
      await createManualDecisionRecord({
        projectId: activeProject.id,
        projectName: activeProject.name,
        title: newDecTitle.trim(),
        description: newDecDesc.trim() || newDecTitle.trim(),
        rationale:
          newDecRationale.trim() || 'Documented by project team during handover verification.',
        decisionMaker:
          newDecMaker.trim() ||
          activeProject.departingMember ||
          reviewerName,
        decisionDate: newDecDate,
      });
      setShowAddDecisionModal(false);
      setNewDecTitle('');
      setNewDecDesc('');
      setNewDecRationale('');
      setNewDecMaker('');
      setViewTab('decisions');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingId(null);
    }
  };

  if (!activeProject) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-2xs">
        <h2 className="text-base font-bold text-slate-900 font-display">
          Select a Project to Manage Tasks, Decisions &amp; Approvals
        </h2>
        <button
          onClick={() => navigate('/projects')}
          className="mt-4 px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-xl cursor-pointer"
        >
          Go to Projects
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-1">
            Feature 2 · AI Task &amp; Decision Management + Human Verification Gate
          </p>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">
            Tasks, Decisions &amp; Knowledge Verification
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage completed vs. pending tasks, record architectural decisions, assign owners, and verify AI-extracted evidence for{' '}
            <span className="font-semibold text-slate-800">{activeProject.name}</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              setNewTaskOwner(activeProject.incomingMember || '');
              setShowAddTaskModal(true);
            }}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            <span>Add Task</span>
          </button>

          <button
            onClick={() => {
              setNewDecMaker(activeProject.departingMember || reviewerName);
              setShowAddDecisionModal(true);
            }}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-sky-600" />
            <span>Add Decision</span>
          </button>

          {unifiedFindings.some(
            (f) => f.reviewStatus === 'pending' && getVerificationLabel(f) === 'Verified'
          ) && (
            <button
              onClick={handleBatchApproveVerifiedOnly}
              disabled={submittingId !== null}
              className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <CheckCheck className="w-4 h-4 text-emerald-600" />
              <span>
                Approve Verified (
                {
                  unifiedFindings.filter(
                    (f) => f.reviewStatus === 'pending' && getVerificationLabel(f) === 'Verified'
                  ).length
                }
                )
              </span>
            </button>
          )}
          <button
            onClick={() => navigate('/handover')}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <span>Handover Reports</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800">
          {errorMsg}
        </div>
      )}

      {/* Dedicated View Tabs Required by Feature 2.2 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all_findings', label: `All Findings (${unifiedFindings.length})` },
              { id: 'all_tasks', label: `All Tasks (${projectTasks.length})` },
              { id: 'completed_tasks', label: `Completed Tasks (${completedTasksCount})` },
              { id: 'pending_tasks', label: `Pending Tasks (${pendingTasksCount})` },
              { id: 'decisions', label: `Important Decisions (${projectDecisions.length})` },
              {
                id: 'risks_deps',
                label: `Risks & Dependencies (${projectRisks.length + projectDependencies.length})`,
              },
            ] as const
          ).map((c) => (
            <button
              key={c.id}
              onClick={() => setViewTab(c.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
                viewTab === c.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'All States' },
              { id: 'pending', label: 'Needs Verification' },
              { id: 'approved', label: 'Human Verified' },
              { id: 'rejected', label: 'Rejected' },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === s.id
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split: Left 8 Cols (Review Cards) + Right 4 Cols (Revision History) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          {filteredFindings.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
              <p className="text-sm font-bold text-slate-800">
                No Items Match Current View Filter
              </p>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Run AI Knowledge Reconstruction first, add a manual task/decision above, or switch view tabs.
              </p>
              <div className="flex items-center justify-center gap-2.5">
                <button
                  onClick={() => setShowAddTaskModal(true)}
                  className="px-3.5 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  + Add Manual Task
                </button>
                <button
                  onClick={() => setShowAddDecisionModal(true)}
                  className="px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  + Add Manual Decision
                </button>
              </div>
            </div>
          ) : (
            filteredFindings.map((item) => {
              const verificationLabel = getVerificationLabel(item);
              const reviewLabel =
                item.reviewStatus === 'approved'
                  ? 'Human Verified & Approved'
                  : item.reviewStatus === 'rejected'
                  ? 'Rejected'
                  : 'Requires Human Verification';

              return (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono uppercase font-bold text-slate-700">
                        {item.category}
                      </span>
                      {item.category === 'task' && item.taskStatus && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`inline-flex items-center gap-1 font-bold uppercase text-[11px] ${
                              item.taskStatus === 'completed'
                                ? 'text-emerald-600'
                                : item.taskStatus === 'blocked'
                                ? 'text-red-600'
                                : 'text-amber-600'
                            }`}
                          >
                            {item.taskStatus === 'completed' ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <Clock className="w-3.5 h-3.5" />
                            )}
                            {item.taskStatus.replace('_', ' ')}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-bold ${
                          verificationLabel === 'Verified'
                            ? 'text-emerald-600'
                            : verificationLabel === 'Inferred'
                            ? 'text-sky-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {verificationLabel} Evidence
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-600 font-medium">
                        Owner: {item.ownerOrContact}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 font-bold ${
                        item.reviewStatus === 'approved'
                          ? 'text-emerald-600'
                          : item.reviewStatus === 'rejected'
                          ? 'text-red-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {item.reviewStatus === 'pending' && (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      )}
                      {reviewLabel}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 font-display">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                  <p className="text-xs text-slate-500 mt-1.5">{item.extraMeta}</p>

                  {/* Source Quotation Box */}
                  <div className="mt-3.5 p-3.5 bg-slate-50 border border-slate-200/70 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-800">
                        Source ({item.sourceDocumentName}):
                      </span>{' '}
                      <span className="italic text-slate-600">&ldquo;{item.sourceQuote}&rdquo;</span>
                    </div>
                    <button
                      onClick={() => setSourceModalItem(item)}
                      className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>View Source</span>
                    </button>
                  </div>

                  {item.reviewerComment && (
                    <p className="mt-2.5 text-xs text-emerald-800 bg-emerald-50/60 px-3 py-2 rounded-lg">
                      <span className="font-bold">Verification Note:</span> {item.reviewerComment}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => openEditDrawer(item)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit &amp; Assign Owner</span>
                      </button>

                      {item.category === 'task' && (
                        <button
                          onClick={() => handleToggleTaskCompletion(item)}
                          disabled={submittingId === item.id}
                          className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            {item.taskStatus === 'completed'
                              ? 'Mark as Pending'
                              : 'Mark as Completed'}
                          </span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleQuickDecision(item, 'approved')}
                        disabled={submittingId === item.id}
                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                          item.reviewStatus === 'approved'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Verify &amp; Approve</span>
                      </button>
                      <button
                        onClick={() => handleQuickDecision(item, 'rejected')}
                        disabled={submittingId === item.id}
                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                          item.reviewStatus === 'rejected'
                            ? 'bg-red-600 text-white'
                            : 'bg-red-50 hover:bg-red-100 text-red-700'
                        }`}
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right 4 Columns: Revision History */}
        <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 font-display">
              Verification Audit Log ({projectReviews.length})
            </h3>
          </div>
          {projectReviews.length === 0 ? (
            <p className="text-xs text-slate-500">
              Every approval, rejection, task completion toggle, or owner assignment is recorded here with reviewer name and comment.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
              {projectReviews.map((rev) => (
                <div key={rev.id} className="py-3 first:pt-0 last:pb-0 text-xs">
                  <div className="flex items-center justify-between text-slate-500 mb-0.5">
                    <span className="font-mono uppercase font-bold text-slate-700">
                      {rev.findingCategory}
                    </span>
                    <span>
                      {rev.previousStatus} →{' '}
                      <strong
                        className={
                          rev.newStatus === 'approved' ? 'text-emerald-600' : 'text-red-600'
                        }
                      >
                        {rev.newStatus.toUpperCase()}
                      </strong>
                    </span>
                  </div>
                  <p className="font-bold text-slate-900 truncate">{rev.findingTitle}</p>
                  {rev.comment && <p className="text-slate-600 mt-0.5">{rev.comment}</p>}
                  <p className="text-[11px] text-slate-400 mt-1">By {rev.reviewerName}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Manual Task Modal */}
      {showAddTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-2xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 font-display">
                Add Manual Project Task
              </h3>
              <button
                onClick={() => setShowAddTaskModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateManualTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g., Complete Spanner shadow-writer JPY rounding unit tests"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description &amp; Handover Context
                </label>
                <textarea
                  rows={3}
                  required
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Describe what needs to be done or what was completed..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Task Status
                  </label>
                  <select
                    value={newTaskStatus}
                    onChange={(e) => setNewTaskStatus(e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Priority Level
                  </label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as PriorityLevel)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned Responsible Person
                </label>
                <input
                  type="text"
                  value={newTaskOwner}
                  onChange={(e) => setNewTaskOwner(e.target.value)}
                  placeholder="e.g., Marcus Vance"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddTaskModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingId !== null}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Manual Decision Modal */}
      {showAddDecisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-2xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 font-display">
                Add Technical or Project Decision
              </h3>
              <button
                onClick={() => setShowAddDecisionModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateManualDecision} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Decision Title
                </label>
                <input
                  type="text"
                  required
                  value={newDecTitle}
                  onChange={(e) => setNewDecTitle(e.target.value)}
                  placeholder="e.g., Standardize on FastAPI + Motor for async document API"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Decision Description
                </label>
                <textarea
                  rows={2}
                  required
                  value={newDecDesc}
                  onChange={(e) => setNewDecDesc(e.target.value)}
                  placeholder="What was decided..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Technical Rationale &amp; Impact (Why this decision was made)
                </label>
                <textarea
                  rows={2}
                  required
                  value={newDecRationale}
                  onChange={(e) => setNewDecRationale(e.target.value)}
                  placeholder="Explain why alternatives were rejected and how it impacts the architecture..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Decision Maker
                  </label>
                  <input
                    type="text"
                    value={newDecMaker}
                    onChange={(e) => setNewDecMaker(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Decision Date
                  </label>
                  <input
                    type="date"
                    value={newDecDate}
                    onChange={(e) => setNewDecDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddDecisionModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingId !== null}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer"
                >
                  Save Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Finding & Comment Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-2xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 font-display">
                Edit &amp; Verify ({editingItem.category.toUpperCase()})
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditAndApprove} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Details
                </label>
                <textarea
                  rows={3}
                  required
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>

              {editingItem.category === 'task' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Task Status
                    </label>
                    <select
                      value={editTaskStatus}
                      onChange={(e) => setEditTaskStatus(e.target.value as TaskStatus)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Priority
                    </label>
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value as PriorityLevel)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white"
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>
              )}

              {editingItem.category === 'decision' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Technical Rationale
                  </label>
                  <input
                    type="text"
                    value={editRationale}
                    onChange={(e) => setEditRationale(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl"
                  />
                </div>
              )}

              {editingItem.category !== 'risk' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assigned Responsible Person / Decision Maker
                  </label>
                  <input
                    type="text"
                    value={editOwner}
                    onChange={(e) => setEditOwner(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reviewer Verification Comment
                </label>
                <input
                  type="text"
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  placeholder="Confirmed owner with departing team lead..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingId !== null}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer"
                >
                  Save &amp; Approve
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Source Evidence Modal */}
      {sourceModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-2xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 max-h-[85vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <p className="text-[11px] font-bold uppercase text-emerald-600">
                  Source Evidence Verification
                </p>
                <h3 className="text-base font-bold text-slate-900 font-display">
                  {sourceModalItem.sourceDocumentName}
                </h3>
              </div>
              <button
                onClick={() => setSourceModalItem(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="my-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
              <p className="font-bold text-emerald-900 mb-1">Extracted Verbatim Quote:</p>
              <p className="italic text-slate-800">&ldquo;{sourceModalItem.sourceQuote}&rdquo;</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 whitespace-pre-wrap">
              {projectDocuments.find((d) => d.fileName === sourceModalItem.sourceDocumentName)
                ?.extractedText || 'Source document text stored in project vault.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
