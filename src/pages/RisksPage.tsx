import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Plus,
  X,
  Check,
  ArrowUpRight,
  FolderKanban,
  Edit3,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  calculateProjectContinuityScore,
  DetectedKnowledgeGap,
} from '../utils/continuityScore';
import {
  reviewFindingRecord,
  createManualRiskRecord,
} from '../services/firestoreService';
import { PriorityLevel } from '../types/models';

export default function RisksPage() {
  const navigate = useNavigate();
  const {
    user,
    userProfile,
    projects,
    activeProject,
    setActiveProjectId,
    projectDocuments,
    projectKnowledge,
    projectDecisions,
    projectTasks,
    projectRisks,
    projectDependencies,
    projectHandovers,
  } = useAppContext();

  const [severityFilter, setSeverityFilter] = useState<'all' | PriorityLevel>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');

  const [showAddRiskModal, setShowAddRiskModal] = useState(false);
  const [newRiskTitle, setNewRiskTitle] = useState('');
  const [newRiskDesc, setNewRiskDesc] = useState('');
  const [newRiskSeverity, setNewRiskSeverity] = useState<PriorityLevel>('high');
  const [newRiskMitigation, setNewRiskMitigation] = useState('');

  const [editingGap, setEditingGap] = useState<DetectedKnowledgeGap | null>(null);
  const [editMitigation, setEditMitigation] = useState('');
  const [editOwner, setEditOwner] = useState('');

  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const reviewerName =
    userProfile?.displayName || user?.displayName || user?.email || 'Authorised Reviewer';

  const continuityReport = useMemo(
    () =>
      calculateProjectContinuityScore({
        project: activeProject,
        documents: projectDocuments,
        knowledge: projectKnowledge,
        decisions: projectDecisions,
        tasks: projectTasks,
        risks: projectRisks,
        dependencies: projectDependencies,
        handovers: projectHandovers,
      }),
    [
      activeProject,
      projectDocuments,
      projectKnowledge,
      projectDecisions,
      projectTasks,
      projectRisks,
      projectDependencies,
      projectHandovers,
    ]
  );

  const allGaps = continuityReport.detectedGaps;
  const totalCount = allGaps.length;
  const criticalCount = allGaps.filter((g) => g.severity === 'critical' && !g.isResolved).length;
  const unresolvedCount = allGaps.filter((g) => !g.isResolved).length;
  const resolvedCount = allGaps.filter((g) => g.isResolved).length;

  const filteredGaps = useMemo(() => {
    return allGaps.filter((gap) => {
      if (severityFilter !== 'all' && gap.severity !== severityFilter) return false;
      if (statusFilter === 'unresolved' && gap.isResolved) return false;
      if (statusFilter === 'resolved' && !gap.isResolved) return false;
      return true;
    });
  }, [allGaps, severityFilter, statusFilter]);

  const handleMarkResolved = async (gap: DetectedKnowledgeGap) => {
    if (!activeProject) return;
    setErrorMsg(null);
    setSubmittingId(gap.id);

    try {
      if (gap.linkedRiskId) {
        await reviewFindingRecord({
          projectId: activeProject.id,
          projectName: activeProject.name,
          category: 'risk',
          findingId: gap.linkedRiskId,
          findingTitle: gap.title,
          previousStatus: 'pending',
          newStatus: 'approved',
          comment: `Risk mitigated and marked Resolved by ${reviewerName}.`,
          reviewerName,
        });
      } else if (gap.linkedTaskId) {
        const defaultOwner =
          activeProject.incomingMember ||
          activeProject.departingMember ||
          reviewerName;
        await reviewFindingRecord({
          projectId: activeProject.id,
          projectName: activeProject.name,
          category: 'task',
          findingId: gap.linkedTaskId,
          findingTitle: gap.title,
          previousStatus: 'pending',
          newStatus: 'approved',
          comment: `Assigned owner (${defaultOwner}) and resolved task ownership gap.`,
          reviewerName,
          updatedFields: {
            assignedOwner: defaultOwner,
          },
        });
      } else if (gap.linkedDecisionId) {
        await reviewFindingRecord({
          projectId: activeProject.id,
          projectName: activeProject.name,
          category: 'decision',
          findingId: gap.linkedDecisionId,
          findingTitle: gap.title,
          previousStatus: 'pending',
          newStatus: 'approved',
          comment: `Decision rationale verified by ${reviewerName}.`,
          reviewerName,
          updatedFields: {
            rationale:
              'Verified architectural decision rationale during Campus Continuity review.',
          },
        });
      } else {
        // Navigate to the appropriate workspace for corpus-level gaps
        navigate('/documents');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingId(null);
    }
  };

  const handleSaveResolutionModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !editingGap) return;
    setErrorMsg(null);
    setSubmittingId(editingGap.id);

    try {
      if (editingGap.linkedRiskId) {
        await reviewFindingRecord({
          projectId: activeProject.id,
          projectName: activeProject.name,
          category: 'risk',
          findingId: editingGap.linkedRiskId,
          findingTitle: editingGap.title,
          previousStatus: 'pending',
          newStatus: 'approved',
          comment: `Mitigation plan updated and marked Resolved by ${reviewerName}.`,
          reviewerName,
          updatedFields: {
            mitigationPlan: editMitigation,
          },
        });
      } else if (editingGap.linkedTaskId) {
        await reviewFindingRecord({
          projectId: activeProject.id,
          projectName: activeProject.name,
          category: 'task',
          findingId: editingGap.linkedTaskId,
          findingTitle: editingGap.title,
          previousStatus: 'pending',
          newStatus: 'approved',
          comment: `Assigned responsible person (${editOwner}) and resolved gap.`,
          reviewerName,
          updatedFields: {
            assignedOwner: editOwner || activeProject.incomingMember || reviewerName,
          },
        });
      } else if (editingGap.linkedDecisionId) {
        await reviewFindingRecord({
          projectId: activeProject.id,
          projectName: activeProject.name,
          category: 'decision',
          findingId: editingGap.linkedDecisionId,
          findingTitle: editingGap.title,
          previousStatus: 'pending',
          newStatus: 'approved',
          comment: `Added technical rationale and marked Verified.`,
          reviewerName,
          updatedFields: {
            rationale: editMitigation,
          },
        });
      }
      setEditingGap(null);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingId(null);
    }
  };

  const handleCreateManualRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !newRiskTitle.trim()) return;
    setErrorMsg(null);
    setSubmittingId('new-risk');
    try {
      await createManualRiskRecord({
        projectId: activeProject.id,
        projectName: activeProject.name,
        title: newRiskTitle.trim(),
        description: newRiskDesc.trim() || newRiskTitle.trim(),
        severity: newRiskSeverity,
        mitigationPlan:
          newRiskMitigation.trim() ||
          'Review with departing and incoming project members before final handover.',
      });
      setShowAddRiskModal(false);
      setNewRiskTitle('');
      setNewRiskDesc('');
      setNewRiskMitigation('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingId(null);
    }
  };

  if (!activeProject) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-2xs">
        <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900 font-display">
          Select a Project to Run the Knowledge Gap &amp; Risk Detector
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
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
            Feature 6 · Automated Knowledge Gap &amp; Risk Detector
          </span>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight mt-0.5">
            Project Risks &amp; Missing Knowledge Detector
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Automatically detects unassigned pending tasks, missing decision rationales, undocumented dependencies, contradictions, and critical blockers for{' '}
            <span className="font-semibold text-slate-800">{activeProject.name}</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-2xs">
            <FolderKanban className="w-4 h-4 text-emerald-600 shrink-0" />
            <select
              value={activeProject.id}
              onChange={(e) => setActiveProjectId(e.target.value)}
              className="text-xs font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowAddRiskModal(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Log Risk / Blocker</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800">
          {errorMsg}
        </div>
      )}

      {/* 4 Summary Cards Required by Feature 6.3 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">
              Total Identified Risks &amp; Gaps
            </span>
            <ShieldAlert className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
            {totalCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Across tasks, decisions, docs &amp; dependencies
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Critical Risks</span>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-3xl font-bold text-red-600 font-mono tabular-nums">
            {criticalCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Immediate handover blockers
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Unresolved Risks</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-amber-600 font-mono tabular-nums">
            {unresolvedCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Require owner assignment or mitigation
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Resolved Risks</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-bold text-emerald-600 font-mono tabular-nums">
            {resolvedCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Verified &amp; mitigated for continuity
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: `All Severities (${totalCount})` },
              {
                id: 'critical',
                label: `Critical (${allGaps.filter((g) => g.severity === 'critical').length})`,
              },
              {
                id: 'high',
                label: `High (${allGaps.filter((g) => g.severity === 'high').length})`,
              },
              {
                id: 'medium',
                label: `Medium (${allGaps.filter((g) => g.severity === 'medium').length})`,
              },
              {
                id: 'low',
                label: `Low (${allGaps.filter((g) => g.severity === 'low').length})`,
              },
            ] as const
          ).map((sev) => (
            <button
              key={sev.id}
              onClick={() => setSeverityFilter(sev.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                severityFilter === sev.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {sev.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'All Statuses' },
              { id: 'unresolved', label: `Unresolved (${unresolvedCount})` },
              { id: 'resolved', label: `Resolved (${resolvedCount})` },
            ] as const
          ).map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                statusFilter === st.id
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Detected Knowledge Gaps & Risks List */}
      <div className="space-y-4">
        {filteredGaps.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-900">
              No Knowledge Gaps or Risks Match Current Filter
            </p>
            <p className="text-xs text-slate-500 mt-1">
              All items in this view have been resolved or no gaps were detected.
            </p>
          </div>
        ) : (
          filteredGaps.map((gap) => (
            <div
              key={gap.id}
              className={`bg-white border rounded-2xl p-6 shadow-2xs transition-all ${
                gap.isResolved
                  ? 'border-emerald-200/80 bg-emerald-50/15'
                  : gap.severity === 'critical'
                  ? 'border-red-200'
                  : 'border-slate-200/80'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`font-mono uppercase font-bold ${
                      gap.severity === 'critical'
                        ? 'text-red-600'
                        : gap.severity === 'high'
                        ? 'text-amber-600'
                        : gap.severity === 'medium'
                        ? 'text-sky-600'
                        : 'text-slate-600'
                    }`}
                  >
                    [{gap.severity.toUpperCase()}]
                  </span>
                  <span className="font-semibold text-slate-700">{gap.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-500">Source: {gap.sourceReference}</span>
                </div>

                <span
                  className={`font-bold ${
                    gap.isResolved ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {gap.isResolved ? 'Resolved' : 'Unresolved'}
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-900 font-display">
                {gap.title}
              </h3>
              <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                {gap.description}
              </p>

              <div className="mt-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                <span className="font-bold text-slate-900">Recommended Action: </span>
                <span className="text-slate-700">{gap.recommendedAction}</span>
              </div>

              <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {(gap.linkedRiskId || gap.linkedTaskId || gap.linkedDecisionId) && (
                    <button
                      onClick={() => {
                        setEditingGap(gap);
                        setEditMitigation(gap.recommendedAction);
                        setEditOwner(activeProject.incomingMember || '');
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>
                        {gap.linkedTaskId
                          ? 'Assign Owner & Resolve'
                          : 'Update Mitigation & Resolve'}
                      </span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!gap.isResolved &&
                    (gap.linkedRiskId || gap.linkedTaskId || gap.linkedDecisionId) && (
                      <button
                        onClick={() => handleMarkResolved(gap)}
                        disabled={submittingId === gap.id}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Mark as Resolved</span>
                      </button>
                    )}

                  {!gap.linkedRiskId &&
                    !gap.linkedTaskId &&
                    !gap.linkedDecisionId && (
                      <button
                        onClick={() =>
                          navigate(
                            gap.category === 'Evidence Contradiction'
                              ? '/reconstruction'
                              : '/documents'
                          )
                        }
                        className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Open Workspace to Resolve</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Update Mitigation / Assign Owner Modal */}
      {editingGap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-2xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 font-display">
                Resolve Knowledge Gap / Risk
              </h3>
              <button
                onClick={() => setEditingGap(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveResolutionModal} className="space-y-4">
              <p className="text-xs font-bold text-slate-800">{editingGap.title}</p>

              {editingGap.linkedTaskId ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assign Responsible Person
                  </label>
                  <input
                    type="text"
                    required
                    value={editOwner}
                    onChange={(e) => setEditOwner(e.target.value)}
                    placeholder="e.g., Marcus Vance"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {editingGap.linkedDecisionId
                      ? 'Documented Technical Rationale'
                      : 'Mitigation Plan & Resolution Notes'}
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={editMitigation}
                    onChange={(e) => setEditMitigation(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingGap(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingId !== null}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer"
                >
                  Save &amp; Mark Resolved
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Manual Risk Modal */}
      {showAddRiskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-2xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 font-display">
                Log Project Risk or Knowledge Gap
              </h3>
              <button
                onClick={() => setShowAddRiskModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateManualRisk} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Risk / Blocker Title
                </label>
                <input
                  type="text"
                  required
                  value={newRiskTitle}
                  onChange={(e) => setNewRiskTitle(e.target.value)}
                  placeholder="e.g., Missing lab GPU cluster SSH credentials for incoming students"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Risk Description &amp; Impact
                </label>
                <textarea
                  rows={3}
                  required
                  value={newRiskDesc}
                  onChange={(e) => setNewRiskDesc(e.target.value)}
                  placeholder="Explain how this risk or gap affects project continuity..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Severity Classification
                </label>
                <select
                  value={newRiskSeverity}
                  onChange={(e) => setNewRiskSeverity(e.target.value as PriorityLevel)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Recommended Mitigation Action
                </label>
                <textarea
                  rows={2}
                  required
                  value={newRiskMitigation}
                  onChange={(e) => setNewRiskMitigation(e.target.value)}
                  placeholder="Concrete steps to resolve this risk before handover..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddRiskModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingId !== null}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer"
                >
                  Save Risk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
