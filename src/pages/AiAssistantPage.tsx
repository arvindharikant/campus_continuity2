import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Send,
  FileText,
  FolderKanban,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  Trash2,
  BookOpen,
  ArrowUpRight,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  askProjectAssistantViaBackend,
  AssistantCitation,
} from '../services/apiService';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  evidenceStatus?: string;
  citations?: AssistantCitation[];
  followUpPrompts?: string[];
}

const SUGGESTED_PROMPTS = [
  'What is this project about?',
  'What work has already been completed?',
  'What tasks are still pending?',
  'Why was this database or architecture chosen?',
  'What problems or blockers exist?',
  'Who worked on which module?',
  'What technologies are used in this project?',
  'What should the next team do first?',
  'What risks exist in this project?',
  'Summarize the complete handover for a new student.',
];

export default function AiAssistantPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  } = useAppContext();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedCitation, setSelectedCitation] =
    useState<AssistantCitation | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialQueryHandledRef = useRef<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || !activeProject || loading) return;

    setErrorMsg(null);
    setInputPrompt('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const historyForApi = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const reply = await askProjectAssistantViaBackend({
        question: trimmed,
        project: activeProject,
        documents: projectDocuments.map((d) => ({
          fileName: d.fileName,
          extractedText: d.extractedText,
        })),
        knowledge: projectKnowledge as unknown as Record<string, unknown>,
        decisions: projectDecisions,
        tasks: projectTasks,
        risks: projectRisks,
        dependencies: projectDependencies,
        history: historyForApi,
      });

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: reply.answer,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        evidenceStatus: reply.evidenceStatus,
        citations: reply.citations || [],
        followUpPrompts: reply.followUpPrompts || [],
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = searchParams.get('q');
    if (
      q &&
      activeProject &&
      initialQueryHandledRef.current !== `${activeProject.id}:${q}`
    ) {
      initialQueryHandledRef.current = `${activeProject.id}:${q}`;
      setSearchParams({}, { replace: true });
      handleSendQuestion(q);
    }
  }, [searchParams, activeProject]);

  if (!activeProject) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-xs">
        <Sparkles className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900 font-display">
          Select a Project to Query the AI Handover Assistant
        </h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
          Create or select a project workspace first so the assistant can ground its answers in your uploaded documents and extracted findings.
        </p>
        <button
          onClick={() => navigate('/projects')}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
        >
          Go to Projects
        </button>
      </div>
    );
  }

  const getEvidenceBadge = (status?: string) => {
    if (status === 'verified' || status === 'verified_evidence') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
          <ShieldCheck className="w-3 h-3" />
          Verified Source Evidence
        </span>
      );
    }
    if (status === 'partially_inferred' || status === 'inferred') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/60">
          <HelpCircle className="w-3 h-3" />
          Inferred from Context
        </span>
      );
    }
    if (status === 'insufficient_evidence') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
          <AlertTriangle className="w-3 h-3" />
          Insufficient Evidence in Corpus
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header & Project Context Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
            Feature 4 · Evidence-Grounded Academic &amp; Technical Q&amp;A
          </span>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight mt-0.5">
            Ask Your Project — AI Knowledge Assistant
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Ask natural-language questions about completed work, pending tasks, architecture decisions, module owners, and risks with verbatim document citations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200/80 rounded-xl px-3 py-2 shadow-xs">
            <FolderKanban className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-medium text-slate-500">Project:</span>
            <select
              value={activeProject.id}
              onChange={(e) => {
                setActiveProjectId(e.target.value);
                setMessages([]);
                setSelectedCitation(null);
              }}
              className="text-xs font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setSelectedCitation(null);
              }}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200/80 hover:bg-slate-50 text-xs font-medium text-slate-600 flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Columns: Chat Interface */}
        <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex flex-col min-h-[620px] max-h-[760px]">
          {/* Active Corpus Status Bar */}
          <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/60 rounded-t-2xl">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-semibold text-slate-900">
                Grounded in {activeProject.code}:
              </span>
              <span>
                {projectDocuments.length} docs · {projectDecisions.length} decisions ·{' '}
                {projectTasks.length} tasks · {projectRisks.length} risks
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Zero-Hallucination Citation Mode
            </span>
          </div>

          {/* Message Thread */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10 px-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 mb-4">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-slate-900 font-display">
                  Ask anything about {activeProject.name}
                </h2>
                <p className="text-xs text-slate-500 max-w-md mt-1 mb-6 leading-relaxed">
                  Every response is strictly grounded in your uploaded documents and reconstructed findings. If information is missing from the project records, the assistant will explicitly let you know.
                </p>

                <div className="w-full max-w-xl">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                    Suggested Project Questions
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                    {SUGGESTED_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handleSendQuestion(prompt)}
                        className="p-3 rounded-xl border border-slate-200/80 hover:border-emerald-400 hover:bg-emerald-50/30 text-xs font-medium text-slate-700 hover:text-slate-900 transition-all flex items-start justify-between gap-2 cursor-pointer group"
                      >
                        <span className="leading-snug">{prompt}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 shrink-0 mt-0.5" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-2xl rounded-2xl p-4 ${
                      msg.role === 'user'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-50 border border-slate-200/80 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider ${
                          msg.role === 'user'
                            ? 'text-emerald-400'
                            : 'text-emerald-700'
                        }`}
                      >
                        {msg.role === 'user' ? 'You' : 'Continuum AI Assistant'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {msg.timestamp}
                      </span>
                    </div>

                    {msg.role === 'assistant' && msg.evidenceStatus && (
                      <div className="mb-2.5">
                        {getEvidenceBadge(msg.evidenceStatus)}
                      </div>
                    )}

                    <div className="text-xs leading-relaxed whitespace-pre-line">
                      {msg.content}
                    </div>

                    {/* Source Citations */}
                    {msg.role === 'assistant' &&
                      msg.citations &&
                      msg.citations.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-200/80">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                            Source Citations & Evidence ({msg.citations.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {msg.citations.map((cit, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedCitation(cit)}
                                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-sky-400 text-[11px] font-medium text-slate-700 hover:text-sky-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                              >
                                <FileText className="w-3 h-3 text-sky-600 shrink-0" />
                                <span className="truncate max-w-[200px]">
                                  {cit.sourceDocumentName}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Follow-up Prompts */}
                    {msg.role === 'assistant' &&
                      msg.followUpPrompts &&
                      msg.followUpPrompts.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex flex-wrap gap-1.5">
                          {msg.followUpPrompts.map((fp, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => handleSendQuestion(fp)}
                              disabled={loading}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-medium cursor-pointer transition-colors"
                            >
                              {fp}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex items-start">
                <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 flex items-center gap-3 text-xs text-slate-600">
                  <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
                  <span>
                    Inspecting {activeProject.code} documents and verified findings...
                  </span>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                {errorMsg}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendQuestion(inputPrompt);
            }}
            className="p-4 border-t border-slate-200/80 bg-white rounded-b-2xl"
          >
            <div className="flex items-center gap-2.5">
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                disabled={loading}
                placeholder={`Ask a question about ${activeProject.name}...`}
                className="flex-1 px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={loading || !inputPrompt.trim()}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Ask AI</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right 4 Columns: Citation Inspector & Document References */}
        <div className="lg:col-span-4 space-y-5">
          {/* Selected Citation Evidence Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-900 font-display">
                Source Evidence Inspector
              </h3>
            </div>

            {selectedCitation ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200/70">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                    Document Reference ({selectedCitation.findingCategory})
                  </p>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">
                    {selectedCitation.sourceDocumentName}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed">
                  "{selectedCitation.quote}"
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed">
                Click any citation chip inside an assistant response to inspect the exact verbatim excerpt and document reference here.
              </p>
            )}
          </div>

          {/* Quick Suggested Prompts */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Suggested Prompts
            </h3>
            <div className="space-y-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSendQuestion(prompt)}
                  disabled={loading}
                  className="w-full text-left px-3 py-2 rounded-xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/70 hover:border-emerald-300 text-xs text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Indexed Project Documents Reference List */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Indexed Project Documents ({projectDocuments.length})
              </h3>
              <button
                type="button"
                onClick={() => navigate('/documents')}
                className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer"
              >
                Manage
              </button>
            </div>
            {projectDocuments.length === 0 ? (
              <p className="text-xs text-slate-500">
                No documents uploaded for this project yet.
              </p>
            ) : (
              <div className="space-y-2">
                {projectDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span className="font-medium text-slate-800 truncate">
                        {doc.fileName}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 shrink-0">
                      {doc.analysisStatus}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
