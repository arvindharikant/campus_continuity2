import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Edit3,
  Trash2,
  Users,
  Calendar,
  ArrowRight,
  UserPlus,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  createProjectRecord,
  updateProjectRecord,
  deleteProjectCascade,
  addProjectMemberRecord,
  removeProjectMemberRecord,
} from '../services/firestoreService';
import { Project, ProjectStatus, HandoverRole, TimelineEvent } from '../types/models';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const {
    projects,
    activeProject,
    setActiveProjectId,
    projectMembers,
    projectDocuments,
    projectKnowledge,
    projectDecisions,
    projectTasks,
    projectRisks,
  } = useAppContext();

  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Project Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('handover_in_progress');
  const [department, setDepartment] = useState('Platform Engineering');
  const [departingMember, setDepartingMember] = useState('');
  const [departingRole, setDepartingRole] = useState('');
  const [incomingMember, setIncomingMember] = useState('');
  const [incomingRole, setIncomingRole] = useState('');
  const [targetHandoverDate, setTargetHandoverDate] = useState('2026-11-30');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Member Form State
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('');
  const [handoverRole, setHandoverRole] = useState<HandoverRole>('reviewer');
  const [addingMember, setAddingMember] = useState(false);

  const openCreateModal = () => {
    setEditingProject(null);
    setName('');
    setCode(`PRJ-${Math.floor(100 + Math.random() * 900)}`);
    setDescription('');
    setStatus('handover_in_progress');
    setDepartment('Core Engineering');
    setDepartingMember('');
    setDepartingRole('Lead Software Engineer');
    setIncomingMember('');
    setIncomingRole('Incoming Tech Lead');
    setTargetHandoverDate('2026-11-30');
    setErrorMsg(null);
    setShowModal(true);
  };

  const openEditModal = (proj: Project) => {
    setEditingProject(proj);
    setName(proj.name);
    setCode(proj.code);
    setDescription(proj.description);
    setStatus(proj.status);
    setDepartment(proj.department);
    setDepartingMember(proj.departingMember);
    setDepartingRole(proj.departingRole);
    setIncomingMember(proj.incomingMember);
    setIncomingRole(proj.incomingRole);
    setTargetHandoverDate(proj.targetHandoverDate);
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      if (editingProject) {
        await updateProjectRecord(editingProject.id, {
          name,
          code,
          description,
          status,
          department,
          departingMember,
          departingRole,
          incomingMember,
          incomingRole,
          targetHandoverDate,
        });
      } else {
        const newId = await createProjectRecord({
          name,
          code,
          description,
          status,
          department,
          departingMember,
          departingRole,
          incomingMember,
          incomingRole,
          targetHandoverDate,
        });
        setActiveProjectId(newId);
      }
      setShowModal(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    setSubmitting(true);
    try {
      await deleteProjectCascade(projectId);
      setConfirmDeleteId(null);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !memberName.trim() || !memberEmail.trim()) return;
    setAddingMember(true);
    try {
      await addProjectMemberRecord({
        projectId: activeProject.id,
        memberName,
        memberEmail,
        role: memberRole || 'Engineer',
        handoverRole,
      });
      setMemberName('');
      setMemberEmail('');
      setMemberRole('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setAddingMember(false);
    }
  };

  const parsedTimeline: TimelineEvent[] = React.useMemo(() => {
    if (!projectKnowledge?.timelineEvents) return [];
    try {
      const arr = JSON.parse(projectKnowledge.timelineEvents);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }, [projectKnowledge]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">
            Project Continuity Workspaces
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Create and manage projects, assign departing and incoming stakeholders, and track reconstructed timelines.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Project</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
          {errorMsg}
        </div>
      )}

      {/* Project List & Active Project Detail Split */}
      {projects.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <h2 className="text-base font-bold text-slate-900 font-display">
            No Projects Created Yet
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            Create your first project workspace to start uploading documents and reconstructing project knowledge with Gemini.
          </p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Create First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 4 Columns: Project Selector List */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-xs font-semibold text-slate-500 px-1">
              All Workspaces ({projects.length})
            </h2>
            {projects.map((proj) => {
              const isSelected = activeProject?.id === proj.id;
              return (
                <div
                  key={proj.id}
                  onClick={() => setActiveProjectId(proj.id)}
                  className={`p-4 rounded-xl border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs mb-1">
                    <span
                      className={`font-mono font-semibold ${
                        isSelected ? 'text-teal-400' : 'text-teal-700'
                      }`}
                    >
                      {proj.code}
                    </span>
                    <span className={isSelected ? 'text-slate-300' : 'text-slate-500'}>
                      {proj.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold font-display truncate">{proj.name}</h3>
                  <p
                    className={`text-xs mt-1 line-clamp-2 ${
                      isSelected ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {proj.description || 'No description provided.'}
                  </p>
                  <div
                    className={`mt-3 pt-2.5 border-t text-xs flex items-center justify-between ${
                      isSelected
                        ? 'border-slate-800 text-slate-300'
                        : 'border-slate-100 text-slate-500'
                    }`}
                  >
                    <span>
                      {proj.departingMember || 'TBD'} → {proj.incomingMember || 'TBD'}
                    </span>
                    <span className="font-mono tabular-nums">{proj.targetHandoverDate}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right 8 Columns: Active Project Detail, Members & Timeline */}
          {activeProject && (
            <div className="lg:col-span-8 space-y-6">
              {/* Project Overview Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-5 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <span className="font-mono font-semibold text-teal-700">
                        {activeProject.code}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{activeProject.department}</span>
                      <span aria-hidden="true">·</span>
                      <span>Status: {activeProject.status.replace(/_/g, ' ')}</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 font-display">
                      {activeProject.name}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {activeProject.status !== 'archived' && (
                      <button
                        onClick={() => openEditModal(activeProject)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDeleteId(activeProject.id)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed mt-4">
                  {activeProject.description || 'No project description provided.'}
                </p>

                {/* Handover Transition Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-100">
                  <div>
                    <p className="text-xs text-slate-500">Departing Member</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">
                      {activeProject.departingMember || 'Not specified'}
                    </p>
                    <p className="text-xs text-slate-500">{activeProject.departingRole}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Incoming Member</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">
                      {activeProject.incomingMember || 'Not specified'}
                    </p>
                    <p className="text-xs text-slate-500">{activeProject.incomingRole}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Target Handover Date</p>
                    <p className="text-sm font-semibold text-slate-900 font-mono tabular-nums mt-0.5">
                      {activeProject.targetHandoverDate || 'Unspecified'}
                    </p>
                    <p className="text-xs text-teal-700 mt-0.5">
                      {projectDocuments.length} docs · {projectDecisions.length} decisions ·{' '}
                      {projectTasks.length} tasks · {projectRisks.length} risks
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => navigate('/documents')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <span>Upload & Manage Documents ({projectDocuments.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => navigate('/reconstruction')}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <span>Open AI Knowledge Reconstruction</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Project Members Section */}
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-teal-600" />
                    <h3 className="text-base font-bold text-slate-900 font-display">
                      Project Members & Handover Roles ({projectMembers.length})
                    </h3>
                  </div>
                </div>

                {/* Add Member Form */}
                <form
                  onSubmit={handleAddMember}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-3 pb-5 mb-5 border-b border-slate-100"
                >
                  <input
                    type="text"
                    required
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    placeholder="Full Name"
                    className="sm:col-span-3 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <input
                    type="email"
                    required
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    placeholder="Email Address"
                    className="sm:col-span-3 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <input
                    type="text"
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                    placeholder="Job Title (e.g. SRE Lead)"
                    className="sm:col-span-3 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <select
                    value={handoverRole}
                    onChange={(e) => setHandoverRole(e.target.value as HandoverRole)}
                    className="sm:col-span-2 px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="departing">Departing</option>
                    <option value="incoming">Incoming</option>
                    <option value="reviewer">Reviewer</option>
                    <option value="stakeholder">Stakeholder</option>
                  </select>
                  <button
                    type="submit"
                    disabled={addingMember}
                    className="sm:col-span-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center cursor-pointer"
                    title="Add Member"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </form>

                {projectMembers.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No project members added yet. Add the departing owner, incoming recipient, and technical reviewers above.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {projectMembers.map((mem) => (
                      <div
                        key={mem.id}
                        className="py-2.5 flex items-center justify-between gap-4 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-slate-900">{mem.memberName}</span>
                          <span className="text-slate-400 mx-1.5" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-slate-600">{mem.role}</span>
                          <span className="text-slate-400 mx-1.5" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-teal-700 font-medium capitalize">
                            {mem.handoverRole}
                          </span>
                          <span className="text-slate-400 mx-1.5" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-slate-500">{mem.memberEmail}</span>
                        </div>
                        <button
                          onClick={() => removeProjectMemberRecord(mem.id)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded cursor-pointer"
                          title="Remove Member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Project Timeline Section */}
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-teal-600" />
                    <h3 className="text-base font-bold text-slate-900 font-display">
                      Reconstructed Project Timeline ({parsedTimeline.length})
                    </h3>
                  </div>
                </div>

                {parsedTimeline.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Run AI Knowledge Reconstruction on your uploaded project documents to automatically reconstruct chronological milestones and cutover dates.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {parsedTimeline.map((ev, idx) => (
                      <div key={idx} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-mono font-semibold text-teal-700 tabular-nums">
                            {ev.dateOrPeriod}
                          </span>
                          <span className="text-slate-500">
                            Status: {ev.status} · Source: {ev.sourceDocumentName}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{ev.eventTitle}</p>
                        <p className="text-xs text-slate-600 mt-0.5">{ev.evidenceNote}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 lg:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
              <h2 className="text-lg font-bold text-slate-900 font-display">
                {editingProject ? 'Edit Project Workspace' : 'Create Project Workspace'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={140}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Horizon Cross-Border Settlement Engine"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Project Code
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={32}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="HZN-CORE"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Project Description & Handover Scope
                </label>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the project architecture, objectives, and why handover is occurring..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Project Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="handover_in_progress">Handover in Progress</option>
                    <option value="review_pending">Review Pending</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Target Handover Date
                  </label>
                  <input
                    type="date"
                    value={targetHandoverDate}
                    onChange={(e) => setTargetHandoverDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Departing Member Name
                  </label>
                  <input
                    type="text"
                    value={departingMember}
                    onChange={(e) => setDepartingMember(e.target.value)}
                    placeholder="Elena Rostova"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Departing Member Role
                  </label>
                  <input
                    type="text"
                    value={departingRole}
                    onChange={(e) => setDepartingRole(e.target.value)}
                    placeholder="Principal Systems Architect"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Incoming Member Name
                  </label>
                  <input
                    type="text"
                    value={incomingMember}
                    onChange={(e) => setIncomingMember(e.target.value)}
                    placeholder="Marcus Vance"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Incoming Member Role
                  </label>
                  <input
                    type="text"
                    value={incomingRole}
                    onChange={(e) => setIncomingRole(e.target.value)}
                    placeholder="Incoming Staff Architect"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
                >
                  {submitting
                    ? 'Saving...'
                    : editingProject
                    ? 'Save Changes'
                    : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-slate-900 font-display">
                Confirm Project Deletion
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Are you sure you want to permanently delete this project workspace and all associated documents, extracted AI findings, reviews, and handover reports? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteProject(confirmDeleteId)}
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                {submitting ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
