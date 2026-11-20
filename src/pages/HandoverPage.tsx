import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Download,
  Share2,
  Save,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Eye,
  Edit3,
  FileCheck,
  ShieldCheck,
  Users,
  FileCode2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { synthesizeRoleHandoverViaBackend } from '../services/apiService';
import {
  createHandoverReportRecord,
  updateHandoverReportRecord,
  deleteHandoverReportRecord,
} from '../services/firestoreService';
import { exportHandoverReportToPdf } from '../utils/pdfExport';
import { calculateProjectContinuityScore } from '../utils/continuityScore';
import { HandoverReport, HandoverTargetRole } from '../types/models';

const ROLE_OPTIONS: Array<{ id: HandoverTargetRole; label: string }> = [
  { id: 'all', label: 'All Roles (Comprehensive)' },
  { id: 'engineering', label: 'Engineering & Architecture' },
  { id: 'product', label: 'Product & Delivery' },
  { id: 'operations', label: 'Operations & SRE' },
  { id: 'executive', label: 'Executive Summary' },
];

export default function HandoverPage() {
  const navigate = useNavigate();
  const {
    activeProject,
    projectDocuments,
    projectMembers,
    projectKnowledge,
    projectDecisions,
    projectTasks,
    projectRisks,
    projectDependencies,
    projectHandovers,
  } = useAppContext();

  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');
  const [includePendingFindings, setIncludePendingFindings] = useState(false);

  const [targetRole, setTargetRole] = useState<HandoverTargetRole>('all');
  const [recipientName, setRecipientName] = useState('');
  const [title, setTitle] = useState('');
  const [overviewSection, setOverviewSection] = useState('');
  const [completedWorkSection, setCompletedWorkSection] = useState('');
  const [pendingWorkSection, setPendingWorkSection] = useState('');
  const [decisionsSection, setDecisionsSection] = useState('');
  const [risksDependenciesSection, setRisksDependenciesSection] = useState('');
  const [unresolvedIssuesSection, setUnresolvedIssuesSection] = useState('');
  const [nextActionsSection, setNextActionsSection] = useState('');
  const [shareStatus, setShareStatus] = useState<'draft' | 'published'>('draft');
  const [sharedWithEmails, setSharedWithEmails] = useState('');

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedReport =
    projectHandovers.find((r) => r.id === selectedReportId) || null;

  useEffect(() => {
    if (projectHandovers.length > 0 && !selectedReportId) {
      setSelectedReportId(projectHandovers[0].id);
    }
  }, [projectHandovers, selectedReportId]);

  useEffect(() => {
    if (selectedReport) {
      setTitle(selectedReport.title);
      setTargetRole(selectedReport.targetRole);
      setRecipientName(selectedReport.recipientName);
      setOverviewSection(selectedReport.overviewSection);
      setCompletedWorkSection(selectedReport.completedWorkSection);
      setPendingWorkSection(selectedReport.pendingWorkSection);
      setDecisionsSection(selectedReport.decisionsSection);
      setRisksDependenciesSection(selectedReport.risksDependenciesSection);
      setUnresolvedIssuesSection(selectedReport.unresolvedIssuesSection);
      setNextActionsSection(selectedReport.nextActionsSection);
      setShareStatus(selectedReport.shareStatus);
      setSharedWithEmails(selectedReport.sharedWithEmails);
    } else if (activeProject) {
      setRecipientName(activeProject.incomingMember || 'Incoming Lead');
    }
  }, [selectedReport, activeProject]);

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

  // Filter findings according to approved-only default vs including pending findings
  const eligibleFindings = useMemo(() => {
    const filterFn = (status: string) =>
      includePendingFindings
        ? status !== 'rejected'
        : status === 'approved';

    const decisions = projectDecisions.filter((d) => filterFn(d.reviewStatus));
    const tasks = projectTasks.filter((t) => filterFn(t.reviewStatus));
    const risks = projectRisks.filter((r) => filterFn(r.reviewStatus));
    const dependencies = projectDependencies.filter((d) => filterFn(d.reviewStatus));

    const totalApproved =
      projectDecisions.filter((d) => d.reviewStatus === 'approved').length +
      projectTasks.filter((t) => t.reviewStatus === 'approved').length +
      projectRisks.filter((r) => r.reviewStatus === 'approved').length +
      projectDependencies.filter((d) => d.reviewStatus === 'approved').length;

    const totalPending =
      projectDecisions.filter((d) => d.reviewStatus === 'pending').length +
      projectTasks.filter((t) => t.reviewStatus === 'pending').length +
      projectRisks.filter((r) => r.reviewStatus === 'pending').length +
      projectDependencies.filter((d) => d.reviewStatus === 'pending').length;

    return {
      decisions,
      tasks,
      risks,
      dependencies,
      totalApproved,
      totalPending,
      totalEligible:
        decisions.length + tasks.length + risks.length + dependencies.length,
    };
  }, [
    includePendingFindings,
    projectDecisions,
    projectTasks,
    projectRisks,
    projectDependencies,
  ]);

  // Derived Ownership Information & Technical Documentation summary for structured preview
  const ownershipSummary = useMemo(() => {
    const map = new Map<string, { role: string; count: number; tasks: string[] }>();
    if (activeProject?.departingMember) {
      map.set(activeProject.departingMember, {
        role: `${activeProject.departingRole || 'Departing Owner'} (Departing)`,
        count: 0,
        tasks: [],
      });
    }
    if (activeProject?.incomingMember) {
      map.set(activeProject.incomingMember, {
        role: `${activeProject.incomingRole || 'Incoming Owner'} (Incoming)`,
        count: 0,
        tasks: [],
      });
    }
    projectMembers.forEach((m) => {
      if (!map.has(m.memberName)) {
        map.set(m.memberName, {
          role: `${m.role} (${m.handoverRole})`,
          count: 0,
          tasks: [],
        });
      }
    });
    eligibleFindings.tasks.forEach((t) => {
      const owner = t.assignedOwner || 'Unassigned';
      const entry = map.get(owner) || {
        role:
          t.evidenceType === 'verified'
            ? 'Verified Task Owner'
            : 'Inferred Owner',
        count: 0,
        tasks: [],
      };
      entry.count += 1;
      entry.tasks.push(t.title);
      map.set(owner, entry);
    });
    return Array.from(map.entries());
  }, [activeProject, projectMembers, eligibleFindings.tasks]);

  const handleGenerateHandoverWithAI = async () => {
    if (!activeProject) return;
    setErrorMsg(null);
    setFeedbackMsg(null);
    setGenerating(true);

    try {
      const synthesized = await synthesizeRoleHandoverViaBackend({
        project: activeProject,
        targetRole,
        recipientName:
          recipientName || activeProject.incomingMember || 'Incoming Lead',
        knowledge: projectKnowledge as unknown as Record<string, unknown>,
        decisions: eligibleFindings.decisions,
        tasks: eligibleFindings.tasks,
        risks: eligibleFindings.risks,
        dependencies: eligibleFindings.dependencies,
      });

      const newId = await createHandoverReportRecord({
        projectId: activeProject.id,
        projectName: activeProject.name,
        title:
          synthesized.title ||
          `${activeProject.code} Handover Report (${targetRole.toUpperCase()})`,
        targetRole,
        recipientName:
          recipientName || activeProject.incomingMember || 'Incoming Lead',
        overviewSection: synthesized.overviewSection || 'Not documented',
        completedWorkSection: synthesized.completedWorkSection || 'Not documented',
        pendingWorkSection: synthesized.pendingWorkSection || 'Not documented',
        decisionsSection: synthesized.decisionsSection || 'Not documented',
        risksDependenciesSection: synthesized.risksDependenciesSection || 'Not documented',
        unresolvedIssuesSection: synthesized.unresolvedIssuesSection || 'Not documented',
        nextActionsSection: synthesized.nextActionsSection || 'Not documented',
        shareStatus: 'published',
        sharedWithEmails: sharedWithEmails || '',
      });

      setSelectedReportId(newId);
      setViewMode('preview');
      setFeedbackMsg(
        `Structured handover report generated (Continuity Score: ${continuityReport.totalScore}/100) and saved to Report History.`
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveReportChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;
    setSaving(true);
    setErrorMsg(null);
    setFeedbackMsg(null);

    try {
      await updateHandoverReportRecord(selectedReport.id, {
        title,
        targetRole,
        recipientName,
        overviewSection,
        completedWorkSection,
        pendingWorkSection,
        decisionsSection,
        risksDependenciesSection,
        unresolvedIssuesSection,
        nextActionsSection,
        shareStatus,
        sharedWithEmails,
      });
      setFeedbackMsg('Handover report sections and approval status saved.');
      setViewMode('preview');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleApprovalStatus = async () => {
    if (!selectedReport) return;
    const nextStatus = shareStatus === 'published' ? 'draft' : 'published';
    setSaving(true);
    try {
      await updateHandoverReportRecord(selectedReport.id, {
        title,
        targetRole,
        recipientName,
        overviewSection,
        completedWorkSection,
        pendingWorkSection,
        decisionsSection,
        risksDependenciesSection,
        unresolvedIssuesSection,
        nextActionsSection,
        shareStatus: nextStatus,
        sharedWithEmails,
      });
      setShareStatus(nextStatus);
      setFeedbackMsg(
        nextStatus === 'published'
          ? 'Handover report approved and published for stakeholder access.'
          : 'Handover report moved back to Draft status.'
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReport = async (id: string) => {
    setSaving(true);
    try {
      await deleteHandoverReportRecord(id);
      if (selectedReportId === id) {
        setSelectedReportId(null);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (!activeProject) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-xs">
        <h2 className="text-base font-bold text-slate-900 font-display">
          Select a Project to Generate Handover Reports
        </h2>
        <button
          onClick={() => navigate('/projects')}
          className="mt-4 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
        >
          Go to Projects
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
            Structured Knowledge Transfer · {activeProject.code}
          </span>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight mt-0.5">
            Handover Reports & Package Builder
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Generate, preview, edit, approve, and export structured handover packages grounded in verified project findings.
          </p>
        </div>

        {selectedReport && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'preview'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview Report</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'edit'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Sections</span>
              </button>
            </div>

            <button
              onClick={() =>
                exportHandoverReportToPdf(
                  selectedReport,
                  activeProject,
                  continuityReport.totalScore
                )
              }
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
          </div>
        )}
      </div>

      {/* Feature 7.1: Pre-Generation Handover Readiness Check */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
              Feature 7.1 · Pre-Generation Readiness Check
            </span>
            <h2 className="text-sm font-bold text-slate-900 font-display">
              Handover Completeness Verification · Continuity Score: {continuityReport.totalScore}/100 ({continuityReport.readinessLevel})
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Any missing section will be clearly marked &ldquo;Not documented&rdquo; in the report.
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          {[
            {
              label: 'Project Metadata',
              ok: continuityReport.handoverChecklist.hasProjectMetadata,
            },
            {
              label: 'Documents Uploaded',
              ok: continuityReport.handoverChecklist.hasUploadedDocs,
            },
            {
              label: 'AI Analysis Run',
              ok: continuityReport.handoverChecklist.hasAnalyzedDocs,
            },
            {
              label: 'Task Owners Assigned',
              ok: continuityReport.handoverChecklist.hasAssignedPendingTasks,
            },
            {
              label: 'Decisions Verified',
              ok: continuityReport.handoverChecklist.hasVerifiedDecisions,
            },
            {
              label: 'Critical Risks Mitigated',
              ok: continuityReport.handoverChecklist.hasMitigatedCriticalRisks,
            },
          ].map((chk) => (
            <div
              key={chk.label}
              className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                chk.ok
                  ? 'bg-emerald-50/50 border-emerald-200/70 text-emerald-900'
                  : 'bg-amber-50/60 border-amber-200/70 text-amber-900'
              }`}
            >
              {chk.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              )}
              <span className="font-semibold text-[11px] leading-tight">{chk.label}</span>
            </div>
          ))}
        </div>

        {continuityReport.handoverChecklist.warnings.length > 0 && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200/70 text-xs text-amber-900">
            <span className="font-bold">Pre-Generation Warnings: </span>
            {continuityReport.handoverChecklist.warnings.join(' · ')}{' '}
            <span className="text-slate-600">
              (You can still generate the report now; unavailable items will be labeled &ldquo;Not documented&rdquo;.)
            </span>
          </div>
        )}
      </div>

      {/* Role-Specific Generator Control Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 font-display">
              Generate New Handover Report
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              By default, handover generation includes only human-approved findings ({eligibleFindings.totalApproved} approved, {eligibleFindings.totalPending} pending review).
            </p>
          </div>

          {/* Approved-only vs Include Pending toggle */}
          <label className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-700 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={includePendingFindings}
              onChange={(e) => setIncludePendingFindings(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
            />
            <span>
              Include Pending Findings ({eligibleFindings.totalPending})
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Target Handover View / Audience Role
            </label>
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value as HandoverTargetRole)}
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Incoming Recipient Name
            </label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder={activeProject.incomingMember || 'Incoming Team Member'}
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="md:col-span-3">
            <button
              onClick={handleGenerateHandoverWithAI}
              disabled={generating}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs whitespace-nowrap transition-colors"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Report</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {feedbackMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Handover Reports List & Preview/Editor Split */}
      {projectHandovers.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-xs">
          <FileCheck className="w-10 h-10 text-emerald-600 mx-auto mb-3 stroke-[1.75]" />
          <p className="text-base font-bold text-slate-900 font-display">
            No Handover Reports Generated for {activeProject.name} Yet
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Select a target role above and click "Generate Report" to synthesize a comprehensive handover package ready for review and PDF export.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 4 Columns: Report History */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Report History ({projectHandovers.length})</span>
              </h3>
            </div>
            {projectHandovers.map((rep: HandoverReport) => {
              const isSelected = rep.id === selectedReport?.id;
              return (
                <div
                  key={rep.id}
                  onClick={() => setSelectedReportId(rep.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-900 border-slate-200/80 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span
                      className={`font-mono uppercase font-semibold ${
                        isSelected ? 'text-emerald-400' : 'text-emerald-700'
                      }`}
                    >
                      Role: {rep.targetRole}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        rep.shareStatus === 'published'
                          ? isSelected
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          : isSelected
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                      }`}
                    >
                      {rep.shareStatus === 'published' ? 'Approved' : 'Draft'}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold font-display truncate">{rep.title}</h4>
                  <p
                    className={`text-xs mt-1 truncate ${
                      isSelected ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    Recipient: {rep.recipientName}
                  </p>
                  <div
                    className={`mt-3 pt-2.5 border-t flex items-center justify-between ${
                      isSelected ? 'border-slate-800' : 'border-slate-100'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        exportHandoverReportToPdf(
                          rep,
                          activeProject,
                          continuityReport.totalScore
                        );
                      }}
                      className={`text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                        isSelected
                          ? 'text-emerald-400 hover:text-white'
                          : 'text-emerald-600 hover:text-emerald-700'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteReport(rep.id);
                      }}
                      className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                      title="Delete Report"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right 8 Columns: Structured Preview or Edit Mode */}
          {selectedReport && (
            <div className="lg:col-span-8">
              {viewMode === 'preview' ? (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 lg:p-8 shadow-xs space-y-6">
                  {/* Report Top Banner */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-5 border-b border-slate-200">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold uppercase bg-slate-100 text-slate-800">
                          {activeProject.code}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold uppercase bg-sky-50 text-sky-700 border border-sky-200/60">
                          Target View: {selectedReport.targetRole}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold uppercase ${
                            shareStatus === 'published'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                          }`}
                        >
                          {shareStatus === 'published'
                            ? 'Approved & Published'
                            : 'Draft Pending Approval'}
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 font-display">
                        {title}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Prepared for <strong className="text-slate-800">{recipientName}</strong> · Departing Owner:{' '}
                        <strong className="text-slate-800">
                          {activeProject.departingMember || 'Project Lead'}
                        </strong>{' '}
                        · Target Date: <span className="font-mono">{activeProject.targetHandoverDate}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleToggleApprovalStatus}
                        disabled={saving}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                          shareStatus === 'published'
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>
                          {shareStatus === 'published'
                            ? 'Revert to Draft'
                            : 'Approve Report'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('edit')}
                        className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Sections</span>
                      </button>
                    </div>
                  </div>

                  {/* Structured Handover Report Sections */}
                  <div className="space-y-6">
                    <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/70">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2">
                        01. Project Overview
                      </h3>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                        {overviewSection || 'No overview content recorded.'}
                      </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/70">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2">
                        02. Important Decisions
                      </h3>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                        {decisionsSection || 'No architectural or product decisions recorded.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/70">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2">
                          03. Completed Work
                        </h3>
                        <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                          {completedWorkSection || 'No completed tasks recorded.'}
                        </p>
                      </div>

                      <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/70">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2">
                          04. Pending Tasks
                        </h3>
                        <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                          {pendingWorkSection || 'No pending tasks recorded.'}
                        </p>
                      </div>
                    </div>

                    {/* Ownership Information & Technical Documentation */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/70">
                        <div className="flex items-center gap-2 mb-2.5">
                          <Users className="w-4 h-4 text-emerald-600" />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                            05. Ownership Information
                          </h3>
                        </div>
                        {ownershipSummary.length === 0 ? (
                          <p className="text-xs text-slate-500">
                            No task owners or project stakeholders assigned yet.
                          </p>
                        ) : (
                          <div className="space-y-2.5">
                            {ownershipSummary.map(([ownerName, info]) => (
                              <div
                                key={ownerName}
                                className="p-2.5 rounded-xl bg-white border border-slate-200/70 text-xs"
                              >
                                <div className="flex items-center justify-between font-semibold text-slate-900">
                                  <span>{ownerName}</span>
                                  <span className="text-[11px] font-mono text-emerald-700">
                                    {info.count} task(s)
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {info.role}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/70">
                        <div className="flex items-center gap-2 mb-2.5">
                          <FileCode2 className="w-4 h-4 text-sky-600" />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-sky-700">
                            06. Technical Documentation & Artifacts
                          </h3>
                        </div>
                        {projectKnowledge?.executiveSummary && (
                          <p className="text-xs text-slate-700 leading-relaxed mb-3 line-clamp-3">
                            {projectKnowledge.executiveSummary}
                          </p>
                        )}
                        {projectDocuments.length === 0 ? (
                          <p className="text-xs text-slate-500">
                            No technical documents linked to this workspace yet.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {projectDocuments.map((doc) => (
                              <div
                                key={doc.id}
                                className="px-3 py-2 rounded-xl bg-white border border-slate-200/70 flex items-center justify-between text-xs"
                              >
                                <span className="font-medium text-slate-800 truncate">
                                  {doc.fileName}
                                </span>
                                <span className="text-[10px] font-mono uppercase text-slate-500 shrink-0 ml-2">
                                  {doc.fileType.toUpperCase()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/70">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">
                        07. Risks & Dependencies
                      </h3>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                        {risksDependenciesSection || 'No active risks or dependencies recorded.'}
                      </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/70">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 mb-2">
                        08. Unresolved Questions & Missing Knowledge
                      </h3>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                        {unresolvedIssuesSection || 'No unresolved questions or contradictions recorded.'}
                      </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200/70">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
                        09. Recommended Next Actions
                      </h3>
                      <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                        {nextActionsSection || 'No recommended next actions recorded.'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleSaveReportChanges}
                  className="bg-white border border-slate-200/80 rounded-2xl p-6 lg:p-8 shadow-xs space-y-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">
                        Handover Package Title
                      </label>
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm font-bold font-display border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          exportHandoverReportToPdf(
                            selectedReport,
                            activeProject,
                            continuityReport.totalScore
                          )
                        }
                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </button>
                    </div>
                  </div>

                  {/* Authorised Sharing & Approval Status Controls */}
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Approval & Publication Status
                      </label>
                      <select
                        value={shareStatus}
                        onChange={(e) =>
                          setShareStatus(e.target.value as 'draft' | 'published')
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                      >
                        <option value="draft">Draft (Internal Review)</option>
                        <option value="published">Approved & Published</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        <Share2 className="w-3.5 h-3.5 inline mr-1 text-emerald-600" />
                        Authorised Stakeholder Emails (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={sharedWithEmails}
                        onChange={(e) => setSharedWithEmails(e.target.value)}
                        placeholder="m.vance@enterprise.example, p.nair@enterprise.example"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                      />
                    </div>
                  </div>

                  {/* Editable Report Sections */}
                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-900 mb-1.5">
                        01. Project Overview & Technical Context
                      </label>
                      <textarea
                        rows={4}
                        value={overviewSection}
                        onChange={(e) => setOverviewSection(e.target.value)}
                        className="w-full p-3.5 text-xs leading-relaxed border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-900 mb-1.5">
                        02. Important Architectural & Product Decisions
                      </label>
                      <textarea
                        rows={5}
                        value={decisionsSection}
                        onChange={(e) => setDecisionsSection(e.target.value)}
                        className="w-full p-3.5 text-xs leading-relaxed border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-900 mb-1.5">
                        03. Verified Completed Work
                      </label>
                      <textarea
                        rows={4}
                        value={completedWorkSection}
                        onChange={(e) => setCompletedWorkSection(e.target.value)}
                        className="w-full p-3.5 text-xs leading-relaxed border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-900 mb-1.5">
                        04. Pending Tasks & Ownership Information
                      </label>
                      <textarea
                        rows={5}
                        value={pendingWorkSection}
                        onChange={(e) => setPendingWorkSection(e.target.value)}
                        className="w-full p-3.5 text-xs leading-relaxed border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-900 mb-1.5">
                        05. Risks, Blockers & External Dependencies
                      </label>
                      <textarea
                        rows={5}
                        value={risksDependenciesSection}
                        onChange={(e) => setRisksDependenciesSection(e.target.value)}
                        className="w-full p-3.5 text-xs leading-relaxed border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-900 mb-1.5">
                        06. Unresolved Questions, Contradictions & Missing Information
                      </label>
                      <textarea
                        rows={5}
                        value={unresolvedIssuesSection}
                        onChange={(e) => setUnresolvedIssuesSection(e.target.value)}
                        className="w-full p-3.5 text-xs leading-relaxed border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-900 mb-1.5">
                        07. Recommended Next Actions for Incoming Member
                      </label>
                      <textarea
                        rows={5}
                        value={nextActionsSection}
                        onChange={(e) => setNextActionsSection(e.target.value)}
                        className="w-full p-3.5 text-xs leading-relaxed border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
