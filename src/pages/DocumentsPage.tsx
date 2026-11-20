import React, { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileText,
  Eye,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  FolderPlus,
  Search,
  Zap,
  Shield,
  Cpu,
  RotateCcw,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { extractDocumentTextViaBackend } from '../services/apiService';
import {
  saveExtractedDocumentRecord,
  deleteDocumentRecord,
} from '../services/firestoreService';
import { SAMPLE_PROJECT_ARTIFACTS } from '../data/sampleArtifacts';
import { ProjectDocument, DocumentFileType } from '../types/models';

interface StructuredDocBrief {
  overview: string;
  objectives: string;
  technologies: string[];
  architecture: string;
  completedActivities: string[];
  pendingActivities: string[];
  technicalDecisions: string[];
  knownProblems: string[];
  dependencies: string[];
  futureRecommendations: string[];
  handoverSummary: string;
  isScannedOrMinimal: boolean;
}

function buildDocumentIntelligenceBrief(docItem: ProjectDocument): StructuredDocBrief {
  const raw = (docItem.extractedText || '').trim();
  const isScannedOrMinimal =
    raw.length < 95 ||
    raw.includes('Document indexed in project continuity vault for review');

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 10 && !/^\[Page\s+\d+\]/i.test(l));

  const techKeywords = [
    'React',
    'TypeScript',
    'Python',
    'FastAPI',
    'Node.js',
    'MongoDB',
    'Cloud Spanner',
    'PostgreSQL',
    'Kafka',
    'Kubernetes',
    'Docker',
    'Terraform',
    'mTLS',
    'SPIFFE',
    'RocksDB',
    'Redis',
    'Cloudflare',
    'Gemini',
    'Firebase',
    'SWIFT',
  ];
  const detectedTech = techKeywords.filter((kw) =>
    new RegExp(`\\b${kw.replace('.', '\\.')}\\b`, 'i').test(raw)
  );

  const completed = lines
    .filter(
      (l) =>
        /\b(completed|done|finished|deployed|provisioned|migrated)\b/i.test(l) &&
        !/\b(not|pending|unfinished|in progress)\b/i.test(l)
    )
    .slice(0, 4);

  const pending = lines
    .filter((l) =>
      /\b(pending|in progress|unfinished|todo|remaining|not merged|blocked|need to)\b/i.test(l)
    )
    .slice(0, 4);

  const decisions = lines
    .filter((l) => /\b(decision|adr|adopt|enforce|selected|approved|deprecated)\b/i.test(l))
    .slice(0, 4);

  const problems = lines
    .filter((l) => /\b(risk|bug|blocker|critical|issue|conflict|contradict|freeze|missing)\b/i.test(l))
    .slice(0, 4);

  const deps = lines
    .filter((l) => /\b(dependency|gateway|api|authority|compliance|contact|partner|cluster)\b/i.test(l))
    .slice(0, 4);

  return {
    overview:
      lines.slice(0, 2).join(' ') ||
      `Project document "${docItem.fileName}" (${docItem.fileType.toUpperCase()}, ${docItem.pageCount} page(s)).`,
    objectives:
      lines.find((l) => /\b(context|objective|goal|problem|sla|purpose|handover)\b/i.test(l)) ||
      'Preserve academic & technical implementation context for incoming project team members.',
    technologies: detectedTech.length > 0 ? detectedTech : ['Standard Project Stack'],
    architecture:
      decisions[0] ||
      lines.find((l) => /\b(architecture|system|service|database|ledger|pipeline)\b/i.test(l)) ||
      'Refer to full extracted text below for implementation details.',
    completedActivities:
      completed.length > 0 ? completed : ['No explicitly completed tasks stated in this file.'],
    pendingActivities:
      pending.length > 0 ? pending : ['No pending activities explicitly isolated in this file.'],
    technicalDecisions:
      decisions.length > 0 ? decisions : ['No formal technical decisions isolated in this file.'],
    knownProblems:
      problems.length > 0 ? problems : ['No critical blockers explicitly flagged in this file.'],
    dependencies:
      deps.length > 0 ? deps : ['No external dependencies explicitly stated in this file.'],
    futureRecommendations: [
      'Cross-verify extracted tasks and owners in the AI Insights & Tasks workspace.',
      'Ensure incoming team members review all flagged open questions before final sign-off.',
    ],
    handoverSummary: `Artifact "${docItem.fileName}" contributes ${completed.length} completed item(s), ${pending.length} pending item(s), ${decisions.length} decision indicator(s), and ${problems.length} risk/issue indicator(s) to the project continuity corpus.`,
    isScannedOrMinimal,
  };
}

export default function DocumentsPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { activeProject, projectDocuments } = useAppContext();

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [previewDoc, setPreviewDoc] = useState<ProjectDocument | null>(null);
  const [previewTab, setPreviewTab] = useState<'summary' | 'raw'>('summary');
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<ProjectDocument | null>(null);

  // Manual text note paste modal
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteFileName, setPasteFileName] = useState('Academic_Handover_Notes.txt');
  const [pasteContent, setPasteContent] = useState('');

  const detectFileType = (fileName: string): DocumentFileType | null => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (ext === 'docx') return 'docx';
    if (ext === 'txt') return 'txt';
    if (ext === 'md') return 'md';
    return null;
  };

  const inferDocumentCategory = (fileName: string): string => {
    const lower = fileName.toLowerCase();
    if (lower.includes('adr') || lower.includes('arch') || lower.includes('spec')) {
      return 'Architecture & Specs';
    }
    if (lower.includes('sprint') || lower.includes('handover') || lower.includes('note')) {
      return 'Handover Notes';
    }
    if (lower.includes('risk') || lower.includes('compliance') || lower.includes('incident')) {
      return 'Risk & Operations';
    }
    return 'Project Documentation';
  };

  const [retryingDocId, setRetryingDocId] = useState<string | null>(null);

  const isScannedPdfWithoutOcr = (docItem: ProjectDocument): boolean => {
    if (docItem.fileType !== 'pdf') return false;
    const txt = (docItem.extractedText || '').trim();
    return (
      txt.length < 95 ||
      txt.includes('Document indexed in project continuity vault for review')
    );
  };

  const getDisplayStatus = (
    docItem: ProjectDocument
  ): 'Uploaded' | 'Processing' | 'Analyzed' | 'Failed' | 'Needs attention' => {
    if (retryingDocId === docItem.id) return 'Processing';
    if (docItem.analysisStatus === 'error') return 'Failed';
    if (!docItem.extractedText || docItem.extractedText.trim().length < 20) {
      return 'Needs attention';
    }
    if (docItem.analysisStatus === 'analysed') return 'Analyzed';
    return 'Uploaded';
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!activeProject) {
      setErrorMsg('Please select or create an active project before uploading documents.');
      return;
    }

    setErrorMsg(null);
    setWarningMsg(null);
    setStatusMessage(null);
    setUploading(true);
    setUploadProgress(15);

    let progressTimer: ReturnType<typeof setInterval> | null = null;
    const scannedWarnings: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // 1. File type validation
        const fType = detectFileType(file.name);
        if (!fType) {
          throw new Error(
            `Unsupported file format for "${file.name}". Allowed formats: PDF (.pdf), Word (.docx), Text (.txt), Markdown (.md).`
          );
        }

        // 2. Empty file validation
        if (file.size === 0) {
          throw new Error(
            `Empty file detected: "${file.name}" contains 0 bytes and cannot be processed.`
          );
        }

        // 3. Maximum file size validation (10 MB recommended / 15 MB hard limit)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(
            `File "${file.name}" exceeds the 10MB maximum file size limit (${(
              file.size /
              (1024 * 1024)
            ).toFixed(2)} MB).`
          );
        }

        // 4. Duplicate upload detection within the active project
        const isDuplicate = projectDocuments.some(
          (existing) =>
            existing.fileName.trim().toLowerCase() === file.name.trim().toLowerCase()
        );
        if (isDuplicate) {
          throw new Error(
            `Duplicate document detected: "${file.name}" is already uploaded in ${activeProject.name}. Delete the existing copy or use Retry Processing.`
          );
        }

        setStatusMessage(`Validating "${file.name}" (${i + 1} of ${files.length})...`);
        setUploadProgress(30);

        const base64Data = await fileToBase64(file);
        setStatusMessage(`Extracting text & metadata from "${file.name}"...`);
        setUploadProgress(55);

        if (progressTimer) clearInterval(progressTimer);
        progressTimer = setInterval(() => {
          setUploadProgress((prev) => (prev < 88 ? prev + 4 : prev));
        }, 180);

        const extracted = await extractDocumentTextViaBackend({
          fileName: file.name,
          fileType: fType,
          fileSize: file.size,
          base64Data,
        });

        if (progressTimer) {
          clearInterval(progressTimer);
          progressTimer = null;
        }

        // Check for scanned PDF with minimal readable text
        if (
          fType === 'pdf' &&
          (!extracted.extractedText ||
            extracted.extractedText.trim().length < 95 ||
            extracted.extractedText.includes('Document indexed in project continuity vault'))
        ) {
          scannedWarnings.push(
            `"${file.name}" appears to be a scanned or image-heavy PDF with minimal embedded text streams. Consider uploading a text-searchable PDF or pasting notes if OCR text is incomplete.`
          );
        }

        setStatusMessage(
          `Saving "${file.name}" (${extracted.pageCount} page${
            extracted.pageCount === 1 ? '' : 's'
          }) to project database...`
        );
        setUploadProgress(94);

        await saveExtractedDocumentRecord({
          projectId: activeProject.id,
          projectName: activeProject.name,
          fileName: extracted.fileName,
          fileType: extracted.fileType,
          fileSize: file.size,
          extractedText: extracted.extractedText,
          pageCount: extracted.pageCount,
        });
      }

      setUploadProgress(100);
      if (scannedWarnings.length > 0) {
        setWarningMsg(scannedWarnings.join(' '));
      }
      setStatusMessage(
        `Successfully uploaded and extracted ${files.length} document${
          files.length === 1 ? '' : 's'
        } (100%).`
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setUploadProgress(0);
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1800);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLoadSamplePack = async () => {
    if (!activeProject) return;
    setErrorMsg(null);
    setWarningMsg(null);
    setUploading(true);
    setUploadProgress(25);
    setStatusMessage(
      'Loading sample project documents (ADR PDF, Handover Notes DOCX, Risk Register TXT)...'
    );
    try {
      let addedCount = 0;
      for (let i = 0; i < SAMPLE_PROJECT_ARTIFACTS.length; i++) {
        const sample = SAMPLE_PROJECT_ARTIFACTS[i];
        const alreadyExists = projectDocuments.some(
          (d) => d.fileName.toLowerCase() === sample.fileName.toLowerCase()
        );
        if (alreadyExists) continue;
        setUploadProgress(Math.round(((i + 1) / SAMPLE_PROJECT_ARTIFACTS.length) * 90));
        await saveExtractedDocumentRecord({
          projectId: activeProject.id,
          projectName: activeProject.name,
          fileName: sample.fileName,
          fileType: sample.fileType,
          fileSize: sample.fileSize,
          extractedText: sample.extractedText,
          pageCount: sample.pageCount,
        });
        addedCount++;
      }
      setUploadProgress(100);
      setStatusMessage(
        addedCount > 0
          ? `Loaded ${addedCount} sample project document(s). Ready for AI Knowledge Reconstruction.`
          : 'Sample project documents are already loaded in this workspace.'
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1200);
    }
  };

  const handleRetryProcessing = async (docItem: ProjectDocument) => {
    if (!activeProject) return;
    setUploading(true);
    setRetryingDocId(docItem.id);
    setErrorMsg(null);
    setStatusMessage(`Re-verifying extracted text for "${docItem.fileName}"...`);
    try {
      const extracted = await extractDocumentTextViaBackend({
        fileName: docItem.fileName,
        fileType: docItem.fileType,
        fileSize: docItem.fileSize,
        rawText: docItem.extractedText || 'Document re-processed.',
      });
      await deleteDocumentRecord(docItem.id);
      await saveExtractedDocumentRecord({
        projectId: activeProject.id,
        projectName: activeProject.name,
        fileName: extracted.fileName,
        fileType: extracted.fileType,
        fileSize: docItem.fileSize,
        extractedText: extracted.extractedText,
        pageCount: extracted.pageCount,
      });
      setStatusMessage(`Successfully re-processed "${docItem.fileName}".`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setRetryingDocId(null);
      setUploading(false);
    }
  };

  const handleSavePastedDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    if (!pasteContent.trim()) {
      setErrorMsg('Empty document content is not allowed. Please enter project notes.');
      return;
    }
    setUploading(true);
    setErrorMsg(null);
    try {
      const cleanName =
        pasteFileName.trim().endsWith('.txt') || pasteFileName.trim().endsWith('.md')
          ? pasteFileName.trim()
          : `${pasteFileName.trim()}.txt`;

      if (
        projectDocuments.some((d) => d.fileName.toLowerCase() === cleanName.toLowerCase())
      ) {
        throw new Error(
          `Duplicate document name: "${cleanName}" already exists in this project.`
        );
      }

      const extracted = await extractDocumentTextViaBackend({
        fileName: cleanName,
        fileType: cleanName.endsWith('.md') ? 'md' : 'txt',
        fileSize: new Blob([pasteContent]).size,
        rawText: pasteContent,
      });

      await saveExtractedDocumentRecord({
        projectId: activeProject.id,
        projectName: activeProject.name,
        fileName: extracted.fileName,
        fileType: extracted.fileType,
        fileSize: new Blob([pasteContent]).size,
        extractedText: extracted.extractedText,
        pageCount: extracted.pageCount,
      });

      setShowPasteModal(false);
      setPasteContent('');
      setStatusMessage(`Saved "${extracted.fileName}" to project document vault.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteDoc) return;
    setUploading(true);
    try {
      await deleteDocumentRecord(confirmDeleteDoc.id);
      setConfirmDeleteDoc(null);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (ts?: { seconds?: number }) => {
    if (!ts?.seconds) return 'Just now';
    return new Date(ts.seconds * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filteredDocuments = useMemo(() => {
    return projectDocuments.filter((docItem) => {
      const matchesSearch =
        !searchTerm.trim() ||
        docItem.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        docItem.extractedText.toLowerCase().includes(searchTerm.toLowerCase());
      const cat = inferDocumentCategory(docItem.fileName);
      const matchesCategory = categoryFilter === 'all' || cat === categoryFilter;
      const st = getDisplayStatus(docItem);
      const matchesStatus = statusFilter === 'all' || st === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [projectDocuments, searchTerm, categoryFilter, statusFilter, uploading]);

  const previewBrief = useMemo(
    () => (previewDoc ? buildDocumentIntelligenceBrief(previewDoc) : null),
    [previewDoc]
  );

  if (!activeProject) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-2xs">
        <h2 className="text-base font-bold text-slate-900 font-display">
          Select or Create a Project Workspace First
        </h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
          Documents are isolated per project workspace. Create or select a project to upload PDF, DOCX, TXT, or Markdown files.
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
            Feature 1 · AI Document Intelligence System
          </span>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight mt-0.5">
            Document Management &amp; Extraction Vault
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Upload project reports, architecture specs, and handover notes for{' '}
            <span className="font-semibold text-slate-800">{activeProject.name}</span>. Includes duplicate detection, empty-file checks, and AI document summaries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={handleLoadSamplePack}
            disabled={uploading}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5 text-emerald-600" />
            <span>Load Sample Pack (3 Docs)</span>
          </button>
          <button
            onClick={() => setShowPasteModal(true)}
            disabled={uploading}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Paste Memo / Notes
          </button>
          {projectDocuments.length > 0 && (
            <button
              onClick={() => navigate('/reconstruction')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Run AI Insights ({projectDocuments.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Large Drag-and-Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFileUpload(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`relative rounded-2xl border-2 border-dashed p-10 sm:p-12 text-center transition-all cursor-pointer ${
          dragActive
            ? 'bg-sky-50 border-sky-500 scale-[0.995]'
            : 'bg-[#F0F7FF]/70 hover:bg-[#F0F7FF] border-sky-400/80'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
          onChange={(e) => handleFileUpload(e.target.files)}
          className="hidden"
        />

        <div className="w-14 h-14 rounded-full bg-sky-500 text-white flex items-center justify-center mx-auto mb-4 shadow-md shadow-sky-500/20">
          <Upload className="w-6 h-6" />
        </div>

        <h2 className="text-lg font-bold text-slate-900 font-display">
          Drop project files here
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto mt-1">
          Automatic text extraction, duplicate checking, structured AI summaries, and source-quoted task &amp; decision extraction.
        </p>
        <p className="text-xs font-semibold text-sky-600 mt-3">
          Or click to browse files (PDF, DOCX, TXT, MD · Max 10MB per file)
        </p>

        {/* Upload Progress Bar */}
        {uploadProgress > 0 && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-md mx-auto mt-6 bg-white p-4 rounded-xl border border-sky-200 shadow-xs"
          >
            <div className="flex items-center justify-between text-xs text-slate-700 font-medium mb-1.5">
              <span>{statusMessage || 'Processing document...'}</span>
              <span className="font-mono tabular-nums font-bold text-sky-600">
                {uploadProgress}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="bg-sky-500 h-full transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* What Happens To Your Documents */}
      <div className="space-y-4">
        <p className="text-[11px] font-bold tracking-wider uppercase text-slate-400 text-center">
          What Happens To Your Documents
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/70 p-4 flex items-start gap-3.5 shadow-2xs">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">AI Document Intelligence</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Extracts overview, objectives, tech stack, completed vs. pending tasks, and decisions
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/70 p-4 flex items-start gap-3.5 shadow-2xs">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Validation &amp; Deduplication</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Blocks empty files, duplicate uploads, oversized payloads, and flags scanned PDFs
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/70 p-4 flex items-start gap-3.5 shadow-2xs">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Persistent Project Vault</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Project-isolated database persistence across browser refreshes and sessions
              </p>
            </div>
          </div>
        </div>

        {/* Supported Formats Footer Row */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs text-slate-500">
          <span>Supported formats:</span>
          {(['PDF', 'DOCX', 'TXT', 'MD'] as const).map((fmt) => (
            <span
              key={fmt}
              className="px-2.5 py-0.5 rounded-md bg-sky-500 text-white font-mono text-[11px] font-semibold"
            >
              {fmt}
            </span>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {warningMsg && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{warningMsg}</span>
        </div>
      )}

      {statusMessage && !uploading && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-4 text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            onClick={() => navigate('/reconstruction')}
            className="font-bold text-emerald-700 hover:underline whitespace-nowrap cursor-pointer"
          >
            Proceed to AI Insights →
          </button>
        </div>
      )}

      {/* Uploaded Documents List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-display">
              Uploaded Project Documents ({filteredDocuments.length})
            </h3>
            <p className="text-xs text-slate-500">
              Inspect AI document summary, preview extracted text, retry processing, or remove outdated artifacts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter documents..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            >
              <option value="all">All Categories</option>
              <option value="Architecture & Specs">Architecture &amp; Specs</option>
              <option value="Handover Notes">Handover Notes</option>
              <option value="Risk & Operations">Risk &amp; Operations</option>
              <option value="Project Documentation">Project Documentation</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            >
              <option value="all">All Statuses</option>
              <option value="Uploaded">Uploaded</option>
              <option value="Processing">Processing</option>
              <option value="Analyzed">Analyzed</option>
              <option value="Needs attention">Needs attention</option>
              <option value="Failed">Failed</option>
            </select>
          </div>
        </div>

        {filteredDocuments.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500">
              {projectDocuments.length === 0
                ? 'No documents uploaded yet. Drop a file above or click "Load Sample Pack (3 Docs)".'
                : 'No documents match your current search or filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Document</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Format</th>
                  <th className="py-3.5 px-4 text-right">Size</th>
                  <th className="py-3.5 px-4 text-right">Pages</th>
                  <th className="py-3.5 px-4">Upload Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredDocuments.map((docItem) => {
                  const statusLabel = getDisplayStatus(docItem);
                  const categoryLabel = inferDocumentCategory(docItem.fileName);
                  const scannedWarning = isScannedPdfWithoutOcr(docItem);
                  return (
                    <tr key={docItem.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-6 font-semibold text-slate-900">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2.5">
                            <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                            <span className="truncate max-w-xs">{docItem.fileName}</span>
                          </div>
                          {scannedWarning && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              Scanned/Low-Text PDF Warning — verify OCR or upload text notes
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{categoryLabel}</td>
                      <td className="py-3.5 px-4 uppercase font-mono text-slate-600">
                        {docItem.fileType}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600">
                        {formatFileSize(docItem.fileSize)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600">
                        {docItem.pageCount}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-500">
                        {formatDate(docItem.createdAt)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-semibold ${
                            statusLabel === 'Analyzed'
                              ? 'text-emerald-600'
                              : statusLabel === 'Uploaded'
                              ? 'text-sky-600'
                              : statusLabel === 'Processing'
                              ? 'text-indigo-600'
                              : statusLabel === 'Needs attention'
                              ? 'text-amber-600'
                              : 'text-red-600'
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setPreviewDoc(docItem);
                              setPreviewTab('summary');
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded-lg inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>AI Summary &amp; Text</span>
                          </button>
                          <button
                            onClick={() => handleRetryProcessing(docItem)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-medium rounded-lg inline-flex items-center gap-1 cursor-pointer"
                            title="Retry Processing"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Retry</span>
                          </button>
                          <button
                            onClick={() => setConfirmDeleteDoc(docItem)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                            title="Delete Document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Document AI Summary & Verbatim Preview Modal */}
      {previewDoc && previewBrief && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-2xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full p-6 max-h-[88vh] flex flex-col shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                  AI Document Intelligence Brief
                </span>
                <h3 className="text-base font-bold text-slate-900 font-display">
                  {previewDoc.fileName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                  Format: {previewDoc.fileType.toUpperCase()} · Size:{' '}
                  {formatFileSize(previewDoc.fileSize)} · Pages: {previewDoc.pageCount} · Status:{' '}
                  {getDisplayStatus(previewDoc)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-xl border border-slate-200 p-1 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('summary')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                      previewTab === 'summary'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    11-Point AI Summary
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('raw')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                      previewTab === 'raw'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Extracted Text ({previewDoc.extractedText.length} chars)
                  </button>
                </div>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {previewBrief.isScannedOrMinimal && (
              <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Scanned PDF Warning: This PDF contains minimal embedded text streams without OCR. You can paste supplementary text notes or upload a searchable PDF for deeper extraction.
                </span>
              </div>
            )}

            {previewTab === 'summary' ? (
              <div className="flex-1 overflow-y-auto my-4 space-y-4 pr-1 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
                    <p className="font-bold text-slate-900 uppercase text-[11px] mb-1">
                      1. Document Overview
                    </p>
                    <p className="text-slate-700 leading-relaxed">{previewBrief.overview}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
                    <p className="font-bold text-slate-900 uppercase text-[11px] mb-1">
                      2. Project Objectives
                    </p>
                    <p className="text-slate-700 leading-relaxed">{previewBrief.objectives}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
                    <p className="font-bold text-slate-900 uppercase text-[11px] mb-1.5">
                      3. Technologies &amp; Tools Mentioned
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {previewBrief.technologies.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono text-[11px] text-slate-800"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
                    <p className="font-bold text-slate-900 uppercase text-[11px] mb-1">
                      4. System Architecture Details
                    </p>
                    <p className="text-slate-700 leading-relaxed">{previewBrief.architecture}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/70">
                    <p className="font-bold text-emerald-900 uppercase text-[11px] mb-1.5">
                      5. Completed Activities
                    </p>
                    <ul className="space-y-1 text-slate-700 list-disc pl-4">
                      {previewBrief.completedActivities.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/70">
                    <p className="font-bold text-amber-900 uppercase text-[11px] mb-1.5">
                      6. Pending Activities
                    </p>
                    <ul className="space-y-1 text-slate-700 list-disc pl-4">
                      {previewBrief.pendingActivities.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
                    <p className="font-bold text-slate-900 uppercase text-[11px] mb-1.5">
                      7. Technical Decisions
                    </p>
                    <ul className="space-y-1 text-slate-700 list-disc pl-4">
                      {previewBrief.technicalDecisions.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200/70">
                    <p className="font-bold text-rose-900 uppercase text-[11px] mb-1.5">
                      8. Known Problems &amp; Blockers
                    </p>
                    <ul className="space-y-1 text-slate-700 list-disc pl-4">
                      {previewBrief.knownProblems.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
                    <p className="font-bold text-slate-900 uppercase text-[11px] mb-1.5">
                      9. Dependencies
                    </p>
                    <ul className="space-y-1 text-slate-700 list-disc pl-4">
                      {previewBrief.dependencies.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
                    <p className="font-bold text-slate-900 uppercase text-[11px] mb-1.5">
                      10. Future Recommendations
                    </p>
                    <ul className="space-y-1 text-slate-700 list-disc pl-4">
                      {previewBrief.futureRecommendations.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 text-white">
                  <p className="font-bold text-emerald-400 uppercase text-[11px] mb-1">
                    11. Handover Summary
                  </p>
                  <p className="text-slate-200 leading-relaxed">{previewBrief.handoverSummary}</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto my-4 p-4 bg-slate-50 border border-slate-200/80 rounded-xl font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                {previewDoc.extractedText || 'No text content extracted.'}
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => {
                  setPreviewDoc(null);
                  navigate('/reconstruction');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Open in AI Insights Workspace →
              </button>
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paste Memo Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-2xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 font-display">
                Add Direct Handover Memo or Lab Notes
              </h3>
              <button
                onClick={() => setShowPasteModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSavePastedDocument} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document File Name
                </label>
                <input
                  type="text"
                  required
                  value={pasteFileName}
                  onChange={(e) => setPasteFileName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document Text Content
                </label>
                <textarea
                  rows={8}
                  required
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  placeholder="Paste architecture notes, academic capstone progress logs, or departing team member handover bullets here..."
                  className="w-full px-3.5 py-2 text-xs font-mono border border-slate-200 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasteModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer"
                >
                  Save Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-2xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 font-display mb-2">
              Delete Document?
            </h3>
            <p className="text-xs text-slate-600 mb-5">
              Are you sure you want to permanently remove{' '}
              <span className="font-semibold text-slate-900">{confirmDeleteDoc.fileName}</span> from
              this project workspace?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteDoc(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={uploading}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl cursor-pointer"
              >
                Delete Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
