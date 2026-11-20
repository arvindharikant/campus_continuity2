import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  FolderKanban,
  ArrowUpRight,
  Layers,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { ContradictionItem, MissingInfoItem } from '../types/models';

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const {
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

  const parsedContradictions: ContradictionItem[] = useMemo(() => {
    if (!projectKnowledge?.contradictions) return [];
    try {
      const arr = JSON.parse(projectKnowledge.contradictions);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }, [projectKnowledge]);

  const parsedMissing: MissingInfoItem[] = useMemo(() => {
    if (!projectKnowledge?.missingInformation) return [];
    try {
      const arr = JSON.parse(projectKnowledge.missingInformation);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }, [projectKnowledge]);

  const metrics = useMemo(() => {
    const allFindings = [
      ...projectDecisions,
      ...projectTasks,
      ...projectRisks,
      ...projectDependencies,
    ];
    const totalFindings = allFindings.length;
    const approvedCount = allFindings.filter(
      (f) => f.reviewStatus === 'approved'
    ).length;
    const pendingCount = allFindings.filter(
      (f) => f.reviewStatus === 'pending'
    ).length;
    const rejectedCount = allFindings.filter(
      (f) => f.reviewStatus === 'rejected'
    ).length;

    const approvalRate =
      totalFindings > 0 ? Math.round((approvedCount / totalFindings) * 100) : 0;

    // Verification basis across findings
    const verifiedBasisCount =
      projectDecisions.filter((d) => d.evidenceType === 'verified').length +
      projectTasks.filter((t) => t.evidenceType === 'verified').length +
      projectRisks.filter((r) => r.evidenceType === 'verified').length +
      projectDependencies.filter((d) => d.sourceQuote && d.sourceQuote.length > 10)
        .length;

    const uncertainBasisCount =
      projectDecisions.filter((d) => d.confidence === 'low').length +
      projectTasks.filter((t) => t.confidence === 'low').length +
      projectRisks.filter((r) => r.confidence === 'low').length;

    const inferredBasisCount = Math.max(
      0,
      totalFindings - verifiedBasisCount - uncertainBasisCount
    );

    // Task completion breakdown
    const completedTasks = projectTasks.filter(
      (t) => t.taskStatus === 'completed'
    ).length;
    const inProgressTasks = projectTasks.filter(
      (t) => t.taskStatus === 'in_progress'
    ).length;
    const blockedTasks = projectTasks.filter(
      (t) => t.taskStatus === 'blocked'
    ).length;
    const pendingTasks = projectTasks.filter(
      (t) => t.taskStatus === 'pending'
    ).length;

    // Risk severity breakdown
    const criticalRisks = projectRisks.filter(
      (r) => r.severity === 'critical'
    ).length;
    const highRisks = projectRisks.filter((r) => r.severity === 'high').length;
    const mediumRisks = projectRisks.filter((r) => r.severity === 'medium').length;
    const lowRisks = projectRisks.filter((r) => r.severity === 'low').length;

    return {
      totalFindings,
      approvedCount,
      pendingCount,
      rejectedCount,
      approvalRate,
      verifiedBasisCount,
      inferredBasisCount,
      uncertainBasisCount,
      completedTasks,
      inProgressTasks,
      blockedTasks,
      pendingTasks,
      criticalRisks,
      highRisks,
      mediumRisks,
      lowRisks,
    };
  }, [projectDecisions, projectTasks, projectRisks, projectDependencies]);

  if (!activeProject) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-xs">
        <BarChart3 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900 font-display">
          Select a Project to View Continuity Analytics
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

  const categoryRows = [
    {
      label: 'Important Decisions',
      count: projectDecisions.length,
      approved: projectDecisions.filter((d) => d.reviewStatus === 'approved').length,
      color: 'bg-emerald-500',
    },
    {
      label: 'Project Tasks & Owners',
      count: projectTasks.length,
      approved: projectTasks.filter((t) => t.reviewStatus === 'approved').length,
      color: 'bg-sky-500',
    },
    {
      label: 'Risks & Blockers',
      count: projectRisks.length,
      approved: projectRisks.filter((r) => r.reviewStatus === 'approved').length,
      color: 'bg-amber-500',
    },
    {
      label: 'System Dependencies',
      count: projectDependencies.length,
      approved: projectDependencies.filter((d) => d.reviewStatus === 'approved')
        .length,
      color: 'bg-indigo-500',
    },
    {
      label: 'Contradictions Flagged',
      count: parsedContradictions.length,
      approved: parsedContradictions.length,
      color: 'bg-rose-500',
    },
    {
      label: 'Missing Knowledge Gaps',
      count: parsedMissing.length,
      approved: parsedMissing.length,
      color: 'bg-slate-600',
    },
  ];

  const maxCategoryCount = Math.max(1, ...categoryRows.map((r) => r.count));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
            Real-Time Continuity Telemetry · {activeProject.code}
          </span>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight mt-0.5">
            Knowledge Reconstruction & Review Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Data-driven breakdown of extracted project findings, verification confidence, risk exposure, and handover readiness.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white border border-slate-200/80 rounded-xl px-3.5 py-2 shadow-xs self-start sm:self-auto">
          <FolderKanban className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-xs font-medium text-slate-500">Workspace:</span>
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
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">
              Review Approval Rate
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold font-display text-slate-900 tabular-nums">
            {metrics.approvalRate}%
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {metrics.approvedCount} of {metrics.totalFindings} findings approved
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">
              Verified Source Evidence
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold font-display text-slate-900 tabular-nums">
            {metrics.verifiedBasisCount}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {metrics.inferredBasisCount} inferred · {metrics.uncertainBasisCount}{' '}
            uncertain
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">
              Critical & High Risks
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold font-display text-slate-900 tabular-nums">
            {metrics.criticalRisks + metrics.highRisks}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {metrics.criticalRisks} critical · {metrics.highRisks} high severity
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">
              Analyzed Corpus Size
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold font-display text-slate-900 tabular-nums">
            {projectDocuments.filter((d) => d.analysisStatus === 'analysed').length}/
            {projectDocuments.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {projectHandovers.length} handover package(s) generated
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Findings by Category Bar Chart */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 font-display">
                Extracted Knowledge Distribution by Category
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Volume of AI-reconstructed items and human approval progress per category
              </p>
            </div>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>

          <div className="space-y-4">
            {categoryRows.map((row) => {
              const widthPct = Math.round((row.count / maxCategoryCount) * 100);
              return (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{row.label}</span>
                    <span className="font-mono text-slate-500 tabular-nums">
                      <strong className="text-slate-900">{row.count}</strong> total ·{' '}
                      <span className="text-emerald-600">{row.approved} approved</span>
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${row.color}`}
                      style={{ width: `${row.count > 0 ? Math.max(widthPct, 6) : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Task & Risk Breakdown */}
        <div className="lg:col-span-5 space-y-6">
          {/* Task Execution Breakdown */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 font-display mb-1">
              Task Status Breakdown
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Current operational state across {projectTasks.length} extracted tasks
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/60">
                <p className="text-[11px] font-semibold text-emerald-700">
                  Completed
                </p>
                <p className="text-xl font-bold font-display text-slate-900 tabular-nums mt-0.5">
                  {metrics.completedTasks}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-sky-50/60 border border-sky-200/60">
                <p className="text-[11px] font-semibold text-sky-700">
                  In Progress
                </p>
                <p className="text-xl font-bold font-display text-slate-900 tabular-nums mt-0.5">
                  {metrics.inProgressTasks}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/60">
                <p className="text-[11px] font-semibold text-amber-700">
                  Pending Handover
                </p>
                <p className="text-xl font-bold font-display text-slate-900 tabular-nums mt-0.5">
                  {metrics.pendingTasks}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/60">
                <p className="text-[11px] font-semibold text-rose-700">
                  Blocked
                </p>
                <p className="text-xl font-bold font-display text-slate-900 tabular-nums mt-0.5">
                  {metrics.blockedTasks}
                </p>
              </div>
            </div>
          </div>

          {/* Risk Severity Matrix */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 font-display mb-1">
              Risk Exposure Matrix
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Severity classification across {projectRisks.length} identified risks
            </p>
            <div className="grid grid-cols-4 gap-2.5 text-center">
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/60">
                <p className="text-lg font-bold font-display text-rose-700 tabular-nums">
                  {metrics.criticalRisks}
                </p>
                <p className="text-[10px] font-bold uppercase text-rose-600 mt-0.5">
                  Critical
                </p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/60">
                <p className="text-lg font-bold font-display text-amber-700 tabular-nums">
                  {metrics.highRisks}
                </p>
                <p className="text-[10px] font-bold uppercase text-amber-600 mt-0.5">
                  High
                </p>
              </div>
              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200/60">
                <p className="text-lg font-bold font-display text-sky-700 tabular-nums">
                  {metrics.mediumRisks}
                </p>
                <p className="text-[10px] font-bold uppercase text-sky-600 mt-0.5">
                  Medium
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-lg font-bold font-display text-slate-700 tabular-nums">
                  {metrics.lowRisks}
                </p>
                <p className="text-[10px] font-bold uppercase text-slate-500 mt-0.5">
                  Low
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* All Workspaces Continuity Overview Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 font-display">
              Workspace Continuity Directory ({projects.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Compare status, departing/incoming owners, and target handover dates across all project workspaces
            </p>
          </div>
          <button
            onClick={() => navigate('/projects')}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Manage Projects</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-3">Code</th>
                <th className="py-3 px-3">Project Name</th>
                <th className="py-3 px-3">Department</th>
                <th className="py-3 px-3">Transition</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Target Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {projects.map((proj) => {
                const isCurrent = proj.id === activeProject.id;
                return (
                  <tr
                    key={proj.id}
                    onClick={() => setActiveProjectId(proj.id)}
                    className={`cursor-pointer transition-colors ${
                      isCurrent ? 'bg-emerald-50/40' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-3 font-mono font-bold text-emerald-700">
                      {proj.code}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      {proj.name}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{proj.department}</td>
                    <td className="py-3 px-3 text-slate-600">
                      {proj.departingMember || 'TBD'} → {proj.incomingMember || 'TBD'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold capitalize bg-slate-100 text-slate-700">
                        {proj.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-500 tabular-nums">
                      {proj.targetHandoverDate}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
