import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  FileText,
  Clock,
  CheckCircle2,
  BookOpenCheck,
  Sparkles,
  ArrowUpRight,
  ArrowRight,
  AlertTriangle,
  Bot,
  Send,
  Rocket,
  Users,
  ShieldAlert,
  Award,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  createProjectRecord,
  addProjectMemberRecord,
  saveExtractedDocumentRecord,
} from '../services/firestoreService';
import { SAMPLE_PROJECT_ARTIFACTS } from '../data/sampleArtifacts';
import { calculateProjectContinuityScore } from '../utils/continuityScore';

export default function DashboardPage() {
  const navigate = useNavigate();
  const {
    user,
    userProfile,
    projects,
    activeProject,
    setActiveProjectId,
    allDocuments,
    allDecisions,
    allTasks,
    allRisks,
    allDependencies,
    allHandovers,
    allActivities,
    projectDocuments,
    projectKnowledge,
    projectDecisions,
    projectTasks,
    projectRisks,
    projectDependencies,
    projectHandovers,
  } = useAppContext();

  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [quickPrompt, setQuickPrompt] = useState('');

  const displayName =
    userProfile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Team Lead';

  // Summary Card Metrics (100% real application data — Section 11.3)
  const totalProjectsCount = projects.length;
  const totalDocumentsCount = allDocuments.length;
  const completedTasksCount = allTasks.filter((t) => t.taskStatus === 'completed').length;
  const pendingTasksCount = allTasks.filter((t) => t.taskStatus !== 'completed').length;
  const importantDecisionsCount = allDecisions.length;
  const unresolvedRisksCount = allRisks.filter((r) => r.reviewStatus !== 'approved').length;

  // Transparent 100-Point Continuity Score for Active Project (Feature 5)
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

  const allFindings = useMemo(
    () => [...allDecisions, ...allTasks, ...allRisks, ...allDependencies],
    [allDecisions, allTasks, allRisks, allDependencies]
  );
  const pendingReviewsCount = allFindings.filter((f) => f.reviewStatus === 'pending').length;

  const unresolvedContradictionsCount = useMemo(() => {
    if (!projectKnowledge?.contradictions) return 0;
    try {
      const parsed = JSON.parse(projectKnowledge.contradictions);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }, [projectKnowledge]);

  // Pending Actions
  const docsAwaitingAnalysis = allDocuments.filter((d) => d.analysisStatus === 'uploaded').length;
  const incompleteHandovers = projects.filter(
    (p) => !allHandovers.some((h) => h.projectId === p.id)
  ).length;

  const handleQuickStartSampleProject = async () => {
    setBootstrapError(null);
    if (!user?.emailVerified) {
      setBootstrapError(
        'Your email is not verified yet. Please sign in with Google for instant verified access to Firestore writes.'
      );
      return;
    }
    setBootstrapping(true);
    try {
      const projectId = await createProjectRecord({
        name: 'Horizon Cross-Border Settlement & Academic FinTech Lab',
        code: 'HZN-CORE',
        description:
          'Multi-region Cloud Spanner ledger migration and SWIFT Gateway v4.2 cutover requiring structured continuity handover from departing lead Elena Rostova to incoming successor Marcus Vance.',
        status: 'handover_in_progress',
        department: 'Computer Science & Distributed Systems Lab',
        departingMember: 'Elena Rostova',
        departingRole: 'Departing Lead Architect',
        incomingMember: 'Marcus Vance',
        incomingRole: 'Incoming Lead Researcher',
        targetHandoverDate: '2026-11-20',
      });

      await addProjectMemberRecord({
        projectId,
        memberName: 'Elena Rostova',
        memberEmail: 'e.rostova@campus.example',
        role: 'Departing Lead Architect',
        handoverRole: 'departing',
      });

      await addProjectMemberRecord({
        projectId,
        memberName: 'Marcus Vance',
        memberEmail: 'm.vance@campus.example',
        role: 'Incoming Lead Researcher',
        handoverRole: 'incoming',
      });

      await addProjectMemberRecord({
        projectId,
        memberName: 'Dr. Priya Nair',
        memberEmail: 'p.nair@campus.example',
        role: 'Faculty Advisor & Security Reviewer',
        handoverRole: 'reviewer',
      });

      for (const sample of SAMPLE_PROJECT_ARTIFACTS) {
        await saveExtractedDocumentRecord({
          projectId,
          projectName: 'Horizon Cross-Border Settlement & Academic FinTech Lab',
          fileName: sample.fileName,
          fileType: sample.fileType,
          fileSize: sample.fileSize,
          extractedText: sample.extractedText,
          pageCount: sample.pageCount,
        });
      }

      setActiveProjectId(projectId);
      navigate('/reconstruction');
    } catch (err: unknown) {
      setBootstrapError(err instanceof Error ? err.message : String(err));
    } finally {
      setBootstrapping(false);
    }
  };

  const formatDate = (ts?: { seconds?: number }) => {
    if (!ts?.seconds) return 'Today';
    return new Date(ts.seconds * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const computeProjectProgress = (projId: string): number => {
    const pDocs = allDocuments.filter((d) => d.projectId === projId);
    const pDecs = allDecisions.filter((d) => d.projectId === projId);
    const pTasks = allTasks.filter((t) => t.projectId === projId);
    const pHandovers = allHandovers.filter((h) => h.projectId === projId);

    let score = 15;
    if (pDocs.length > 0) score += 25;
    if (pDecs.length + pTasks.length > 0) score += 25;
    const approved =
      pDecs.filter((d) => d.reviewStatus === 'approved').length +
      pTasks.filter((t) => t.reviewStatus === 'approved').length;
    if (approved > 0) score += 20;
    if (pHandovers.length > 0) score += 15;
    return Math.min(100, score);
  };

  const launchAssistantWithPrompt = (promptText: string) => {
    navigate(`/assistant?q=${encodeURIComponent(promptText)}`);
  };

  return (
    <div className="space-y-7">
      {/* Top Welcome Banner with Campus Continuity Tagline */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-emerald-600 mb-1">
            Campus Continuity · Preserve Knowledge. Continue Innovation.
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display tracking-tight">
            Welcome back, {displayName}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Campus Continuity ensures that no academic project loses its knowledge when its students leave.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {projects.length === 0 ? (
            <button
              onClick={handleQuickStartSampleProject}
              disabled={bootstrapping}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Rocket className="w-4 h-4" />
              <span>
                {bootstrapping
                  ? 'Provisioning Workspace...'
                  : 'Initialize Sample Project & 3 Docs'}
              </span>
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate('/documents')}
                className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Upload Documents
              </button>
              <button
                onClick={() => navigate('/reconstruction')}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Run AI Insights</span>
              </button>
            </>
          )}
        </div>
      </div>

      {bootstrapError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800">
          {bootstrapError}
        </div>
      )}

      {/* 6 Summary Cards Required by Section 11.3 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div
          onClick={() => navigate('/projects')}
          className="bg-white rounded-2xl p-4 border border-slate-200/70 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Total Projects</span>
            <FolderKanban className="w-4 h-4 text-slate-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {totalProjectsCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {projects.filter((p) => p.status === 'handover_in_progress').length} active handovers
          </p>
        </div>

        <div
          onClick={() => navigate('/documents')}
          className="bg-white rounded-2xl p-4 border border-slate-200/70 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Total Documents</span>
            <FileText className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {totalDocumentsCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {allDocuments.filter((d) => d.analysisStatus === 'analysed').length} analyzed by AI
          </p>
        </div>

        <div
          onClick={() => navigate('/review')}
          className="bg-white rounded-2xl p-4 border border-slate-200/70 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Completed Tasks</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 font-mono tabular-nums">
            {completedTasksCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Verified finished work
          </p>
        </div>

        <div
          onClick={() => navigate('/review')}
          className="bg-white rounded-2xl p-4 border border-slate-200/70 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Pending Tasks</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {pendingTasksCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            For incoming team members
          </p>
        </div>

        <div
          onClick={() => navigate('/review')}
          className="bg-white rounded-2xl p-4 border border-slate-200/70 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Important Decisions</span>
            <BookOpenCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {importantDecisionsCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Architecture &amp; design log
          </p>
        </div>

        <div
          onClick={() => navigate('/risks')}
          className="bg-white rounded-2xl p-4 border border-slate-200/70 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Unresolved Risks</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-bold text-rose-600 font-mono tabular-nums">
            {unresolvedRisksCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {continuityReport.detectedGaps.filter((g) => !g.isResolved).length} total gaps detected
          </p>
        </div>
      </div>

      {/* Main Dashboard Grid: Left 8 Cols + Right 4 Cols */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Columns */}
        <div className="lg:col-span-8 space-y-6">
          {/* Feature 5: AI Project Continuity Score (0-100) with 5 Weighted Categories & Deductions */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                  Feature 5 · Transparent 100-Point Readiness Formula
                </span>
                <h2 className="text-base font-bold text-slate-900 font-display mt-0.5">
                  AI Project Continuity Score{' '}
                  {activeProject ? `— ${activeProject.name}` : ''}
                </h2>
                <p className="text-xs text-slate-500">
                  Evaluates Documentation (25), Task Tracking (20), Decisions (20), Risks &amp; Blockers (20), and Handover Readiness (15).
                </p>
              </div>
              <button
                onClick={() => navigate('/analytics')}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>Full Score Breakdown</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Circular Ring Chart */}
              <div className="md:col-span-4 flex flex-col items-center sm:flex-row md:flex-col gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/70 text-center">
                <div className="relative w-28 h-28 shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-200"
                      strokeWidth="3.8"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className={`${
                        continuityReport.totalScore >= 80
                          ? 'text-emerald-500'
                          : continuityReport.totalScore >= 55
                          ? 'text-sky-500'
                          : 'text-amber-500'
                      } transition-all duration-500`}
                      strokeDasharray={`${continuityReport.totalScore}, 100`}
                      strokeWidth="3.8"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                      {continuityReport.totalScore}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">
                      / 100 PTS
                    </span>
                  </div>
                </div>
                <div>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                    <Award className="w-3.5 h-3.5" />
                    {continuityReport.readinessLevel}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {continuityReport.deductions.length === 0
                      ? 'All 5 continuity criteria achieved full score.'
                      : `${continuityReport.deductions.length} improvement area(s) identified below.`}
                  </p>
                </div>
              </div>

              {/* 5 Weighted Category Bars */}
              <div className="md:col-span-8 space-y-3">
                {continuityReport.categories.map((cat) => (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{cat.label}</span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {cat.earnedPoints} / {cat.maxPoints} pts
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          cat.status === 'strong'
                            ? 'bg-emerald-500'
                            : cat.status === 'moderate'
                            ? 'bg-sky-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.max(4, cat.percentage)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">{cat.summary}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Explainable Point Deductions & Improvement Recommendations */}
            {continuityReport.deductions.length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-800 mb-2.5">
                  Score Deduction Explanations &amp; Improvement Recommendations:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {continuityReport.deductions.slice(0, 4).map((ded, idx) => (
                    <div
                      key={idx}
                      onClick={() => navigate(ded.actionPath)}
                      className="p-3 rounded-xl bg-slate-50 hover:bg-emerald-50/50 border border-slate-200/70 text-xs cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between font-bold text-slate-900 mb-0.5">
                        <span>{ded.category}</span>
                        <span className="font-mono text-amber-700">-{ded.pointsLost} pts</span>
                      </div>
                      <p className="text-slate-600 text-[11px]">{ded.reason}</p>
                      <p className="text-emerald-700 font-semibold text-[11px] mt-1">
                        Fix: {ded.recommendation} →
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section A: Project Overview Cards */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-slate-900 font-display">
                  Project Workspaces
                </h2>
                <p className="text-xs text-slate-500">
                  Active academic &amp; technical continuity workspaces, handover progress, and team transitions.
                </p>
              </div>
              <button
                onClick={() => navigate('/projects')}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>All Projects ({projects.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center">
                <p className="text-sm font-bold text-slate-900">
                  No Project Workspaces Yet
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                  Click below to provision a sample project workspace with 3 realistic technical documents, or create your own project.
                </p>
                <button
                  onClick={handleQuickStartSampleProject}
                  disabled={bootstrapping}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  {bootstrapping
                    ? 'Provisioning...'
                    : 'Initialize Sample Project & 3 Docs'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((proj) => {
                  const progress = computeProjectProgress(proj.id);
                  const isCurrent = activeProject?.id === proj.id;
                  return (
                    <div
                      key={proj.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isCurrent
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-slate-50/50 border-slate-200/70 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                            <span className="font-mono font-bold text-emerald-700">
                              {proj.code}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="capitalize">
                              {proj.status.replace(/_/g, ' ')}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>Updated {formatDate(proj.updatedAt || proj.createdAt)}</span>
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 font-display truncate">
                            {proj.name}
                          </h3>
                          <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {proj.departingMember || 'Departing Member'} →{' '}
                              {proj.incomingMember || 'Incoming Member'}
                            </span>
                          </p>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="w-32">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-slate-500">Readiness</span>
                              <span className="font-mono font-bold text-slate-900 tabular-nums">
                                {progress}%
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setActiveProjectId(proj.id);
                              navigate('/projects');
                            }}
                            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                          >
                            View Project
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom Split: Pending Actions & Recent Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-900 font-display">
                  Pending Actions
                </h2>
                <ShieldAlert className="w-4 h-4 text-amber-500" />
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">
                      Documents Awaiting AI Analysis
                    </p>
                    <p className="text-slate-500 mt-0.5">
                      <span className="font-mono font-bold text-slate-800 tabular-nums">
                        {docsAwaitingAnalysis}
                      </span>{' '}
                      uploaded document(s) need Gemini extraction
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/reconstruction')}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-emerald-700 hover:bg-emerald-50 cursor-pointer shrink-0"
                  >
                    Analyze
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">
                      Tasks &amp; Decisions Awaiting Verification
                    </p>
                    <p className="text-slate-500 mt-0.5">
                      <span className="font-mono font-bold text-amber-600 tabular-nums">
                        {pendingReviewsCount}
                      </span>{' '}
                      extracted items require human approval
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/review')}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-emerald-700 hover:bg-emerald-50 cursor-pointer shrink-0"
                  >
                    Verify
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">
                      Knowledge Gaps &amp; Unresolved Risks
                    </p>
                    <p className="text-slate-500 mt-0.5">
                      <span className="font-mono font-bold text-red-600 tabular-nums">
                        {continuityReport.detectedGaps.filter((g) => !g.isResolved).length}
                      </span>{' '}
                      detected gaps or risks need mitigation
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/risks')}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-emerald-700 hover:bg-emerald-50 cursor-pointer shrink-0"
                  >
                    Inspect
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">Incomplete Handovers</p>
                    <p className="text-slate-500 mt-0.5">
                      <span className="font-mono font-bold text-slate-800 tabular-nums">
                        {incompleteHandovers}
                      </span>{' '}
                      project(s) without a finalized report
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/handover')}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-emerald-700 hover:bg-emerald-50 cursor-pointer shrink-0"
                  >
                    Compile
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-900 font-display">
                  Recent Activity
                </h2>
                <span className="text-xs font-mono text-slate-400 tabular-nums">
                  {allActivities.length} events
                </span>
              </div>

              {allActivities.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  Document uploads, AI analyses, review approvals, and report generations will appear here.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {allActivities.slice(0, 5).map((act) => (
                    <div key={act.id} className="py-3 first:pt-0 last:pb-0 text-xs">
                      <div className="flex items-center justify-between text-slate-400 mb-0.5">
                        <span className="font-semibold text-slate-800">
                          {act.projectName}
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatDate(act.createdAt)}
                        </span>
                      </div>
                      <p className="text-slate-600 leading-relaxed line-clamp-2">
                        {act.summary}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 4 Columns: Ask Your Project AI Assistant Quick Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 font-display">
                      Ask Your Project
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      AI Knowledge Assistant
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Grounded Q&amp;A
                </span>
              </div>

              <div className="text-center my-4">
                <p className="text-base font-bold text-slate-900 font-display">
                  What would you like to know about{' '}
                  {activeProject ? activeProject.code : 'your project'}?
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Instant answers grounded in uploaded project reports, extracted tasks, decisions, and risks.
                </p>
              </div>

              {/* Suggested Action Cards */}
              <div className="space-y-2.5 my-5">
                {[
                  {
                    label: 'What work has already been completed?',
                    desc: 'List verified milestones and completed tasks',
                    prompt: 'What work has already been completed?',
                  },
                  {
                    label: 'What tasks are still pending?',
                    desc: 'View unfinished tasks and assigned owners',
                    prompt: 'What tasks are still pending?',
                  },
                  {
                    label: 'Why was this architecture chosen?',
                    desc: 'Inspect technical decisions and rationales',
                    prompt: 'Why was this architecture chosen?',
                  },
                  {
                    label: 'What should the next team do first?',
                    desc: 'Prioritized onboarding & handover action plan',
                    prompt: 'What should the next team do first?',
                  },
                ].map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => launchAssistantWithPrompt(action.prompt)}
                    className="w-full p-3.5 rounded-xl bg-slate-50 hover:bg-emerald-50/70 border border-slate-200/70 hover:border-emerald-200 text-left transition-all flex items-center justify-between gap-3 group cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-800">
                        {action.label}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {action.desc}
                      </p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Inline Question Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!quickPrompt.trim()) return;
                launchAssistantWithPrompt(quickPrompt.trim());
              }}
              className="pt-4 border-t border-slate-100"
            >
              <label className="block text-[11px] font-semibold text-slate-500 mb-2">
                Ask a question about project records
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={quickPrompt}
                  onChange={(e) => setQuickPrompt(e.target.value)}
                  placeholder="Ask anything with source citations..."
                  className="w-full pl-3.5 pr-10 py-2.5 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                  title="Ask Your Project"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>

          {/* Contradiction Alert Card if Contradictions Exist */}
          {unresolvedContradictionsCount > 0 && (
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Evidence Contradiction Detected</span>
              </div>
              <p className="text-sm font-bold font-display">
                {unresolvedContradictionsCount} conflicting statement(s) across project documents
              </p>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Conflicting cutover dates or architectural claims were detected across uploaded documents. Inspect the source quotes before approving the handover.
              </p>
              <button
                onClick={() => navigate('/reconstruction')}
                className="mt-4 w-full py-2 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Inspect Contradictions
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
