import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileSearch,
  ArrowRight,
  RefreshCw,
  FileText,
  X,
  BookOpen,
  Users,
  Calendar,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { runGeminiKnowledgeReconstruction } from '../services/apiService';
import { saveAiReconstructionToFirestore } from '../services/firestoreService';
import {
  ContradictionItem,
  MissingInfoItem,
  UnresolvedQuestionItem,
  TimelineEvent,
} from '../types/models';

type ReconstructionSection =
  | 'decisions'
  | 'completed_tasks'
  | 'pending_tasks'
  | 'task_owners'
  | 'risks'
  | 'dependencies'
  | 'contradictions'
  | 'missing_knowledge'
  | 'timeline';

interface EvidencePreviewState {
  title: string;
  sourceDocumentName: string;
  sourceQuote: string;
  evidenceType?: string;
  confidence?: string;
}

export default function AiReconstructionPage() {
  const navigate = useNavigate();
  const {
    projects,
    activeProject,
    activeProjectId,
    setActiveProjectId,
    projectDocuments,
    projectKnowledge,
    projectDecisions,
    projectTasks,
    projectRisks,
    projectDependencies,
  } = useAppContext();

  const [activeSection, setActiveSection] = useState<ReconstructionSection>('decisions');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [stepLabel, setStepLabel] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [evidenceDrawer, setEvidenceDrawer] = useState<EvidencePreviewState | null>(null);

  // Select all project documents by default when project changes
  useEffect(() => {
    setSelectedDocIds(projectDocuments.map((d) => d.id));
  }, [projectDocuments]);

  const toggleDocSelection = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const completedTasks = useMemo(
    () => projectTasks.filter((t) => t.taskStatus === 'completed'),
    [projectTasks]
  );

  const pendingTasks = useMemo(
    () => projectTasks.filter((t) => t.taskStatus !== 'completed'),
    [projectTasks]
  );

  // Group tasks by assigned owner
  const ownersMap = useMemo(() => {
    const map: Record<string, typeof projectTasks> = {};
    for (const t of projectTasks) {
      const key = t.assignedOwner || 'Unassigned (Not stated in source)';
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return Object.entries(map);
  }, [projectTasks]);

  const parsedContradictions: ContradictionItem[] = useMemo(() => {
    if (!projectKnowledge?.contradictions) return [];
    try {
      const a = JSON.parse(projectKnowledge.contradictions);
      return Array.isArray(a) ? a : [];
    } catch {
      return [];
    }
  }, [projectKnowledge]);

  const parsedMissingInfo: MissingInfoItem[] = useMemo(() => {
    if (!projectKnowledge?.missingInformation) return [];
    try {
      const a = JSON.parse(projectKnowledge.missingInformation);
      return Array.isArray(a) ? a : [];
    } catch {
      return [];
    }
  }, [projectKnowledge]);

  const parsedUnresolved: UnresolvedQuestionItem[] = useMemo(() => {
    if (!projectKnowledge?.unresolvedQuestions) return [];
    try {
      const a = JSON.parse(projectKnowledge.unresolvedQuestions);
      return Array.isArray(a) ? a : [];
    } catch {
      return [];
    }
  }, [projectKnowledge]);

  const parsedTimeline: TimelineEvent[] = useMemo(() => {
    if (!projectKnowledge?.timelineEvents) return [];
    try {
      const a = JSON.parse(projectKnowledge.timelineEvents);
      return Array.isArray(a) ? a : [];
    } catch {
      return [];
    }
  }, [projectKnowledge]);

  const handleRunReconstruction = async () => {
    if (!activeProject) return;
    const docsToAnalyze = projectDocuments.filter((d) => selectedDocIds.includes(d.id));
    if (docsToAnalyze.length === 0) {
      setErrorMsg('Please select at least one project document to analyze.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setRunning(true);
    setAnalysisProgress(15);

    let progressInterval: ReturnType<typeof setInterval> | null = null;

    try {
      setStepLabel(
        `Step 1/3: Preparing ${docsToAnalyze.length} selected document(s) for Gemini analysis...`
      );

      const docsPayload = docsToAnalyze.map((d) => ({
        fileName: d.fileName,
        fileType: d.fileType,
        extractedText: d.extractedText,
      }));

      setAnalysisProgress(35);
      setStepLabel(
        'Step 2/3: Running server-side Gemini Flash knowledge reconstruction (extracting decisions, tasks, owners, risks, dependencies, contradictions & source quotes)...'
      );

      progressInterval = setInterval(() => {
        setAnalysisProgress((prev) => (prev < 86 ? prev + 3 : prev));
      }, 450);

      const reconstruction = await runGeminiKnowledgeReconstruction({
        projectName: activeProject.name,
        projectDescription: activeProject.description,
        departingMember: activeProject.departingMember,
        incomingMember: activeProject.incomingMember,
        documents: docsPayload,
      });

      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }

      setAnalysisProgress(92);
      setStepLabel(
        'Step 3/3: Validating schema boundaries and persisting structured findings to Cloud Firestore...'
      );

      await saveAiReconstructionToFirestore(
        activeProject.id,
        activeProject.name,
        docsToAnalyze.map((d) => d.id),
        reconstruction
      );

      setAnalysisProgress(100);
      setStepLabel(null);
      const decCount = Array.isArray(reconstruction?.decisions) ? reconstruction.decisions.length : 0;
      const taskCount = Array.isArray(reconstruction?.tasks) ? reconstruction.tasks.length : 0;
      const riskCount = Array.isArray(reconstruction?.risks) ? reconstruction.risks.length : 0;
      setSuccessMsg(
        `Knowledge reconstruction complete (100%): Extracted ${decCount} decision(s), ${taskCount} task(s), and ${riskCount} risk(s) across ${docsToAnalyze.length} document(s).`
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      if (progressInterval) clearInterval(progressInterval);
      setRunning(false);
      setTimeout(() => setAnalysisProgress(0), 1500);
    }
  };

  const extractPageRef = (quote: string, docText?: string): string => {
    const match = quote.match(/\[Page\s+\d+\]/i);
    if (match) return match[0];
    if (docText) {
      const idx = docText.toLowerCase().indexOf(quote.slice(0, 35).toLowerCase());
      if (idx !== -1) {
        const before = docText.slice(0, idx);
        const pageMarkers = before.match(/\[Page\s+\d+\]/gi);
        if (pageMarkers && pageMarkers.length > 0) {
          return pageMarkers[pageMarkers.length - 1];
        }
      }
    }
    return 'Verbatim Excerpt';
  };

  const matchedSourceDoc = useMemo(() => {
    if (!evidenceDrawer) return null;
    return (
      projectDocuments.find(
        (d) =>
          d.fileName.toLowerCase() === evidenceDrawer.sourceDocumentName.toLowerCase() ||
          evidenceDrawer.sourceDocumentName.toLowerCase().includes(d.fileName.toLowerCase())
      ) || null
    );
  }, [evidenceDrawer, projectDocuments]);

  if (!activeProject) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-2xs">
        <h2 className="text-base font-bold text-slate-900 font-display">
          Select or Create a Project Workspace
        </h2>
        <p className="text-xs text-slate-500 mt-1 mb-5">
          Create a project first to run AI knowledge reconstruction.
        </p>
        <button
          onClick={() => navigate('/projects')}
          className="px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-xl cursor-pointer"
        >
          Go to Projects
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Top Workspace Control Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <p className="text-xs font-semibold text-sky-600 mb-1">
              Evidence-Linked Gemini 3.8 Flash Engine
            </p>
            <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">
              AI Knowledge Reconstruction Workspace
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Select authorised project documents and reconstruct verified decisions, completed vs. pending tasks, owners, risks, and contradictions.
            </p>
          </div>

          {/* Project Selector & Primary Run Action */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <select
              aria-label="Select Project"
              value={activeProjectId || ''}
              onChange={(e) => setActiveProjectId(e.target.value)}
              className="px-3.5 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleRunReconstruction}
              disabled={running || selectedDocIds.length === 0}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              {running ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing ({selectedDocIds.length} Docs)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>
                    Run Gemini Analysis ({selectedDocIds.length} Selected)
                  </span>
                </>
              )}
            </button>

            {projectKnowledge && (
              <button
                onClick={() => navigate('/review')}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <span>Review Findings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Selected Document List with Checkboxes */}
        <div className="pt-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold text-slate-700">
              Authorised Source Documents in Scope ({selectedDocIds.length} of {projectDocuments.length} selected)
            </span>
            <button
              onClick={() => navigate('/documents')}
              className="text-xs font-semibold text-emerald-600 hover:underline cursor-pointer"
            >
              + Upload More Documents
            </button>
          </div>

          {projectDocuments.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span>No documents uploaded to this project yet.</span>
              <button
                onClick={() => navigate('/documents')}
                className="px-3 py-1.5 bg-emerald-600 text-white font-semibold rounded-lg cursor-pointer"
              >
                Upload Documents
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {projectDocuments.map((docItem) => {
                const isChecked = selectedDocIds.includes(docItem.id);
                return (
                  <label
                    key={docItem.id}
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2.5 cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-emerald-50/50 border-emerald-300 text-slate-900'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleDocSelection(docItem.id)}
                        className="rounded accent-emerald-600 w-3.5 h-3.5 shrink-0"
                      />
                      <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                      <span className="font-semibold truncate">{docItem.fileName}</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 shrink-0">
                      {docItem.pageCount}p
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Analysis Progress Indicator */}
      {running && stepLabel && (
        <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-md space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
              <p className="text-sm font-bold font-display">{stepLabel}</p>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-400 tabular-nums">
              {analysisProgress}%
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${analysisProgress}%` }}
            />
          </div>
          <p className="text-xs text-slate-400">
            Enforcing strict evidence rules: distinguishing Verified vs. Inferred claims, extracting verbatim quotes, and flagging contradictions.
          </p>
        </div>
      )}

      {successMsg && !running && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-4 text-xs text-emerald-900">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button
            onClick={() => navigate('/review')}
            className="font-bold text-emerald-700 hover:underline whitespace-nowrap cursor-pointer"
          >
            Open Knowledge Review →
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800">
          {errorMsg}
        </div>
      )}

      {/* Analysis Results & 9 Structured Sections */}
      {!projectKnowledge && !running ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-2xs">
          <FileSearch className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900 font-display">
            Ready to Reconstruct Project Knowledge
          </h2>
          <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1 mb-5 leading-relaxed">
            Click &quot;Run Gemini Analysis&quot; above to extract decisions, completed tasks, pending tasks, task owners, risks, dependencies, contradictions, missing knowledge, and timeline milestones.
          </p>
        </div>
      ) : (
        projectKnowledge && (
          <>
            {/* Executive Analysis Summary Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900 font-display">
                    Analysis Summary — {activeProject.name}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Reconstructed from {projectKnowledge.sourceDocumentCount} source document(s) · Evidence Completeness Score:{' '}
                    <span className="font-mono font-bold text-emerald-600 tabular-nums">
                      {projectKnowledge.confidenceScore}%
                    </span>
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Executive Continuity Summary
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {projectKnowledge.executiveSummary}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Verified Completed Work Summary
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {projectKnowledge.completedWorkSummary}
                  </p>
                </div>
              </div>
            </div>

            {/* 9 Section Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
              {(
                [
                  { id: 'decisions', label: `Important Decisions (${projectDecisions.length})` },
                  { id: 'completed_tasks', label: `Completed Tasks (${completedTasks.length})` },
                  { id: 'pending_tasks', label: `Pending Tasks (${pendingTasks.length})` },
                  { id: 'task_owners', label: `Task Owners (${ownersMap.length})` },
                  { id: 'risks', label: `Risks (${projectRisks.length})` },
                  { id: 'dependencies', label: `Dependencies (${projectDependencies.length})` },
                  { id: 'contradictions', label: `Contradictions (${parsedContradictions.length})` },
                  {
                    id: 'missing_knowledge',
                    label: `Missing Knowledge (${parsedMissingInfo.length + parsedUnresolved.length})`,
                  },
                  { id: 'timeline', label: `Timeline & Milestones (${parsedTimeline.length})` },
                ] as const
              ).map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                    activeSection === sec.id
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {sec.label}
                </button>
              ))}
            </div>

            {/* 1. Important Decisions */}
            {activeSection === 'decisions' && (
              <div className="space-y-4">
                {projectDecisions.map((dec) => {
                  const sDoc = projectDocuments.find((d) => d.fileName === dec.sourceDocumentName);
                  const pageRef = extractPageRef(dec.sourceQuote, sDoc?.extractedText);
                  return (
                    <div
                      key={dec.id}
                      className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-2">
                        <div className="flex items-center gap-2 text-slate-600">
                          <span className="font-bold text-slate-900">
                            Decision Maker: {dec.decisionMaker}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>Date: {dec.decisionDate}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span
                            className={`font-bold ${
                              dec.evidenceType === 'verified'
                                ? 'text-emerald-600'
                                : 'text-amber-600'
                            }`}
                          >
                            {dec.evidenceType.toUpperCase()}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-500">
                            Confidence: {dec.confidence.toUpperCase()}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-700 font-semibold">
                            Review: {dec.reviewStatus.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 font-display">
                        {dec.title}
                      </h3>
                      <p className="text-sm text-slate-700 mt-1.5 leading-relaxed">
                        {dec.description}
                      </p>
                      <p className="text-xs text-slate-600 mt-2">
                        <strong className="text-slate-900">Rationale:</strong> {dec.rationale}
                      </p>

                      <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200/70 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800">
                            Supporting Document: {dec.sourceDocumentName} ({pageRef})
                          </p>
                          <p className="italic text-slate-600 mt-0.5 line-clamp-2">
                            &ldquo;{dec.sourceQuote}&rdquo;
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            setEvidenceDrawer({
                              title: dec.title,
                              sourceDocumentName: dec.sourceDocumentName,
                              sourceQuote: dec.sourceQuote,
                              evidenceType: dec.evidenceType,
                              confidence: dec.confidence,
                            })
                          }
                          className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 rounded-lg font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Source Preview</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2 & 3. Completed Tasks / Pending Tasks */}
            {(activeSection === 'completed_tasks' || activeSection === 'pending_tasks') && (
              <div className="space-y-4">
                {(activeSection === 'completed_tasks' ? completedTasks : pendingTasks).length ===
                0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500">
                    No tasks in this category.
                  </div>
                ) : (
                  (activeSection === 'completed_tasks' ? completedTasks : pendingTasks).map(
                    (task) => {
                      const sDoc = projectDocuments.find(
                        (d) => d.fileName === task.sourceDocumentName
                      );
                      const pageRef = extractPageRef(task.sourceQuote, sDoc?.extractedText);
                      return (
                        <div
                          key={task.id}
                          className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-bold uppercase ${
                                  task.taskStatus === 'completed'
                                    ? 'text-emerald-600'
                                    : task.taskStatus === 'blocked'
                                    ? 'text-red-600'
                                    : 'text-amber-600'
                                }`}
                              >
                                {task.taskStatus.replace(/_/g, ' ')}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="text-slate-600">
                                Priority: <strong>{task.priority.toUpperCase()}</strong>
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-semibold text-slate-900">
                                Owner: {task.assignedOwner}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 font-mono text-[11px]">
                              <span
                                className={`font-bold ${
                                  task.evidenceType === 'verified'
                                    ? 'text-emerald-600'
                                    : 'text-amber-600'
                                }`}
                              >
                                {task.evidenceType.toUpperCase()}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="text-slate-500">
                                Review: {task.reviewStatus.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <h3 className="text-base font-bold text-slate-900 font-display">
                            {task.title}
                          </h3>
                          <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                            {task.description}
                          </p>

                          <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200/70 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800">
                                Supporting Document: {task.sourceDocumentName} ({pageRef})
                              </p>
                              <p className="italic text-slate-600 mt-0.5 line-clamp-2">
                                &ldquo;{task.sourceQuote}&rdquo;
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                setEvidenceDrawer({
                                  title: task.title,
                                  sourceDocumentName: task.sourceDocumentName,
                                  sourceQuote: task.sourceQuote,
                                  evidenceType: task.evidenceType,
                                  confidence: task.confidence,
                                })
                              }
                              className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 rounded-lg font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>Source Preview</span>
                            </button>
                          </div>
                        </div>
                      );
                    }
                  )
                )}
              </div>
            )}

            {/* 4. Task Owners Matrix */}
            {activeSection === 'task_owners' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ownersMap.map(([ownerName, tasksForOwner]) => {
                  const isUnassigned = ownerName.toLowerCase().includes('unassigned');
                  return (
                    <div
                      key={ownerName}
                      className={`bg-white rounded-2xl border p-6 shadow-2xs ${
                        isUnassigned ? 'border-amber-300' : 'border-slate-200/80'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <Users
                            className={`w-4 h-4 ${
                              isUnassigned ? 'text-amber-600' : 'text-emerald-600'
                            }`}
                          />
                          <h3 className="text-sm font-bold text-slate-900 font-display">
                            {ownerName}
                          </h3>
                        </div>
                        <span className="text-xs font-mono font-semibold text-slate-500 tabular-nums">
                          {tasksForOwner.length} task(s)
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {tasksForOwner.map((t) => (
                          <div
                            key={t.id}
                            className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                          >
                            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                              <span className="font-bold uppercase text-slate-700">
                                {t.taskStatus.replace(/_/g, ' ')}
                              </span>
                              <span>{t.sourceDocumentName}</span>
                            </div>
                            <p className="font-bold text-slate-900">{t.title}</p>
                            <button
                              onClick={() =>
                                setEvidenceDrawer({
                                  title: t.title,
                                  sourceDocumentName: t.sourceDocumentName,
                                  sourceQuote: t.sourceQuote,
                                  evidenceType: t.evidenceType,
                                  confidence: t.confidence,
                                })
                              }
                              className="text-[11px] font-semibold text-emerald-600 hover:underline mt-1 cursor-pointer"
                            >
                              Inspect Source Quote →
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 5. Risks */}
            {activeSection === 'risks' && (
              <div className="space-y-4">
                {projectRisks.map((risk) => (
                  <div
                    key={risk.id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-2">
                      <span
                        className={`font-bold uppercase ${
                          risk.severity === 'critical' || risk.severity === 'high'
                            ? 'text-red-600'
                            : 'text-amber-600'
                        }`}
                      >
                        Severity: {risk.severity}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {risk.evidenceType.toUpperCase()} · Confidence:{' '}
                        {risk.confidence.toUpperCase()} · Review: {risk.reviewStatus.toUpperCase()}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 font-display">
                      {risk.title}
                    </h3>
                    <p className="text-sm text-slate-700 mt-1">{risk.description}</p>
                    <p className="text-xs text-slate-600 mt-2">
                      <strong className="text-slate-900">Mitigation Plan:</strong>{' '}
                      {risk.mitigationPlan}
                    </p>
                    <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800">
                          Supporting Document: {risk.sourceDocumentName}
                        </p>
                        <p className="italic text-slate-600 mt-0.5 line-clamp-2">
                          &ldquo;{risk.sourceQuote}&rdquo;
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setEvidenceDrawer({
                            title: risk.title,
                            sourceDocumentName: risk.sourceDocumentName,
                            sourceQuote: risk.sourceQuote,
                            evidenceType: risk.evidenceType,
                            confidence: risk.confidence,
                          })
                        }
                        className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 rounded-lg font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Source Preview</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 6. Dependencies */}
            {activeSection === 'dependencies' && (
              <div className="space-y-4">
                {projectDependencies.map((dep) => (
                  <div
                    key={dep.id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-2">
                      <div>
                        <span className="font-bold uppercase text-slate-900">
                          {dep.dependencyType} Dependency
                        </span>
                        <span className="mx-1.5" aria-hidden="true">
                          ·
                        </span>
                        <span
                          className={`font-semibold uppercase ${
                            dep.status === 'blocked' || dep.status === 'at_risk'
                              ? 'text-red-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          Status: {dep.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-slate-600">
                        Owner / Contact: <strong>{dep.ownerContact}</strong>
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 font-display">{dep.name}</h3>
                    <p className="text-sm text-slate-700 mt-1">{dep.description}</p>
                    <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800">
                          Supporting Document: {dep.sourceDocumentName}
                        </p>
                        <p className="italic text-slate-600 mt-0.5 line-clamp-2">
                          &ldquo;{dep.sourceQuote}&rdquo;
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setEvidenceDrawer({
                            title: dep.name,
                            sourceDocumentName: dep.sourceDocumentName,
                            sourceQuote: dep.sourceQuote,
                            evidenceType: 'verified',
                            confidence: 'high',
                          })
                        }
                        className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 rounded-lg font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Source Preview</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 7. Contradictions */}
            {activeSection === 'contradictions' && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <h3 className="text-base font-bold text-slate-900 font-display">
                    Contradictory Evidence Across Documents ({parsedContradictions.length})
                  </h3>
                </div>
                {parsedContradictions.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No contradictions detected across the selected documents.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {parsedContradictions.map((c, idx) => (
                      <div key={idx} className="py-4 first:pt-0 last:pb-0">
                        <h4 className="text-sm font-bold text-slate-900">{c.topic}</h4>
                        <p className="text-xs text-slate-700 mt-1">{c.conflictDescription}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-xs">
                          <div className="p-3 bg-red-50/50 border border-red-100 rounded-xl">
                            <span className="font-bold text-slate-900">Source Claim A:</span>{' '}
                            <span className="text-slate-700">{c.sourceA}</span>
                          </div>
                          <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                            <span className="font-bold text-slate-900">Source Claim B:</span>{' '}
                            <span className="text-slate-700">{c.sourceB}</span>
                          </div>
                        </div>
                        <p className="text-xs text-emerald-800 mt-2.5">
                          <strong className="font-semibold">Resolution Action:</strong>{' '}
                          {c.resolutionRecommendation}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 8. Missing Knowledge & Unresolved Questions */}
            {activeSection === 'missing_knowledge' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
                  <div className="flex items-center gap-2 mb-4">
                    <HelpCircle className="w-4 h-4 text-amber-600" />
                    <h3 className="text-base font-bold text-slate-900 font-display">
                      Missing Operational &amp; Technical Knowledge ({parsedMissingInfo.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {parsedMissingInfo.map((m, idx) => (
                      <div key={idx} className="py-3.5 first:pt-0 last:pb-0 text-xs">
                        <p className="font-bold text-slate-900 text-sm">{m.missingItem}</p>
                        <p className="text-slate-600 mt-1">
                          <strong>Impact:</strong> {m.impact}
                        </p>
                        <p className="text-emerald-700 font-semibold mt-1">
                          Who to Ask: {m.whoToAsk}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="w-4 h-4 text-sky-600" />
                    <h3 className="text-base font-bold text-slate-900 font-display">
                      Unresolved Questions ({parsedUnresolved.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {parsedUnresolved.map((u, idx) => (
                      <div key={idx} className="py-3.5 first:pt-0 last:pb-0 text-xs">
                        <p className="font-bold text-slate-900 text-sm">{u.question}</p>
                        <p className="text-slate-600 mt-1">{u.context}</p>
                        <p className="text-slate-400 mt-1 font-mono">
                          Source: {u.sourceDocumentName}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 9. Timeline & Milestones */}
            {activeSection === 'timeline' && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-base font-bold text-slate-900 font-display">
                    Reconstructed Project Timeline &amp; Milestones ({parsedTimeline.length})
                  </h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {parsedTimeline.map((ev, idx) => (
                    <div key={idx} className="py-3.5 first:pt-0 last:pb-0 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-emerald-700 tabular-nums">
                          {ev.dateOrPeriod}
                        </span>
                        <span className="text-slate-500">
                          Status: <strong className="uppercase">{ev.status}</strong> · Document:{' '}
                          {ev.sourceDocumentName}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900">{ev.eventTitle}</p>
                      <p className="text-slate-600 mt-0.5">{ev.evidenceNote}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )
      )}

      {/* Source Evidence Preview Slide-Over Panel */}
      {evidenceDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-2xs">
          <div className="bg-white w-full max-w-2xl h-full flex flex-col shadow-2xl border-l border-slate-200 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <p className="text-[11px] font-bold uppercase text-emerald-600">
                  Source Evidence Inspector
                </p>
                <h3 className="text-base font-bold text-slate-900 font-display">
                  {evidenceDrawer.title}
                </h3>
              </div>
              <button
                onClick={() => setEvidenceDrawer(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Verbatim Quote Box */}
            <div className="my-4 p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs">
              <div className="flex items-center justify-between text-emerald-800 font-semibold mb-1.5">
                <span>Document: {evidenceDrawer.sourceDocumentName}</span>
                {evidenceDrawer.evidenceType && (
                  <span className="uppercase font-mono">
                    {evidenceDrawer.evidenceType} ({evidenceDrawer.confidence})
                  </span>
                )}
              </div>
              <p className="text-slate-900 italic font-medium leading-relaxed">
                &ldquo;{evidenceDrawer.sourceQuote}&rdquo;
              </p>
            </div>

            {/* Full Source Document Context */}
            <div className="flex-1 flex flex-col min-h-0">
              <p className="text-xs font-bold text-slate-700 mb-2">
                Full Document Context ({matchedSourceDoc?.fileName || evidenceDrawer.sourceDocumentName})
              </p>
              <div className="flex-1 overflow-y-auto p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                {matchedSourceDoc?.extractedText ||
                  'Full document text is stored in the project vault.'}
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setEvidenceDrawer(null)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
