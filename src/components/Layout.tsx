import React, { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Sparkles,
  ClipboardCheck,
  BookOpenCheck,
  BarChart3,
  Bot,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  Layers,
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { auth } from '../firebase';
import { useAppContext } from '../context/AppContext';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'WORKSPACE' | 'INTELLIGENCE' | 'SYSTEM';
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, group: 'WORKSPACE' },
  { path: '/projects', label: 'Projects', icon: FolderKanban, group: 'WORKSPACE' },
  { path: '/documents', label: 'Document Management', icon: FileText, group: 'WORKSPACE' },
  { path: '/reconstruction', label: 'AI Insights', icon: Sparkles, group: 'INTELLIGENCE' },
  { path: '/review', label: 'Tasks & Decisions', icon: ClipboardCheck, group: 'INTELLIGENCE' },
  { path: '/risks', label: 'Project Risks', icon: ShieldAlert, group: 'INTELLIGENCE' },
  { path: '/assistant', label: 'Ask Your Project', icon: Bot, group: 'INTELLIGENCE' },
  { path: '/handover', label: 'Handover Reports', icon: BookOpenCheck, group: 'INTELLIGENCE' },
  { path: '/analytics', label: 'Continuity Analytics', icon: BarChart3, group: 'SYSTEM' },
  { path: '/settings', label: 'Settings', icon: Settings, group: 'SYSTEM' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    userProfile,
    projects,
    activeProject,
    activeProjectId,
    setActiveProjectId,
    allDocuments,
    allDecisions,
    allTasks,
    allRisks,
    allActivities,
    projectDocuments,
    projectDecisions,
    projectTasks,
    projectRisks,
    projectDependencies,
  } = useAppContext();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const pendingReviewsCount =
    projectDecisions.filter((d) => d.reviewStatus === 'pending').length +
    projectTasks.filter((t) => t.reviewStatus === 'pending').length +
    projectRisks.filter((r) => r.reviewStatus === 'pending').length +
    projectDependencies.filter((d) => d.reviewStatus === 'pending').length;

  const currentNav = NAV_ITEMS.find((item) => item.path === location.pathname) || NAV_ITEMS[0];

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/auth');
  };

  // Global search across real projects, documents, decisions, tasks, risks
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: Array<{
      id: string;
      title: string;
      subtitle: string;
      category: string;
      path: string;
      projectId?: string;
    }> = [];

    for (const p of projects) {
      if (p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)) {
        results.push({
          id: p.id,
          title: `${p.code} — ${p.name}`,
          subtitle: `Project · ${p.department}`,
          category: 'Project',
          path: '/projects',
          projectId: p.id,
        });
      }
    }
    for (const d of allDocuments) {
      if (d.fileName.toLowerCase().includes(q) || d.extractedText.toLowerCase().includes(q)) {
        results.push({
          id: d.id,
          title: d.fileName,
          subtitle: `Document · ${d.fileType.toUpperCase()} · ${d.pageCount} pages`,
          category: 'Document',
          path: '/documents',
          projectId: d.projectId,
        });
      }
    }
    for (const dec of allDecisions) {
      if (dec.title.toLowerCase().includes(q) || dec.description.toLowerCase().includes(q)) {
        results.push({
          id: dec.id,
          title: dec.title,
          subtitle: `Decision · ${dec.evidenceType.toUpperCase()} · ${dec.sourceDocumentName}`,
          category: 'Decision',
          path: '/review',
          projectId: dec.projectId,
        });
      }
    }
    for (const t of allTasks) {
      if (t.title.toLowerCase().includes(q) || t.assignedOwner.toLowerCase().includes(q)) {
        results.push({
          id: t.id,
          title: t.title,
          subtitle: `Task (${t.taskStatus}) · Owner: ${t.assignedOwner}`,
          category: 'Task',
          path: '/review',
          projectId: t.projectId,
        });
      }
    }
    for (const r of allRisks) {
      if (r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)) {
        results.push({
          id: r.id,
          title: r.title,
          subtitle: `Risk (${r.severity.toUpperCase()}) · ${r.sourceDocumentName}`,
          category: 'Risk',
          path: '/review',
          projectId: r.projectId,
        });
      }
    }
    return results.slice(0, 8);
  }, [searchQuery, projects, allDocuments, allDecisions, allTasks, allRisks]);

  const userInitials = useMemo(() => {
    const name = userProfile?.displayName || user?.email || 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [userProfile, user]);

  const getBadgeCount = (path: string): number | null => {
    if (path === '/projects') return projects.length || null;
    if (path === '/documents') return projectDocuments.length || null;
    if (path === '/review') return pendingReviewsCount || null;
    if (path === '/risks') {
      const unresolvedRisks = projectRisks.filter((r) => r.reviewStatus !== 'approved').length;
      return unresolvedRisks || null;
    }
    return null;
  };

  return (
    <div className="min-h-screen flex bg-[#F4F6F9] text-slate-900">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200/80 select-none z-30 transition-all duration-200 ${
          collapsed ? 'lg:w-[76px]' : 'lg:w-[260px]'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100">
          <Link
            to="/"
            className="flex items-center gap-2.5 min-w-0 overflow-hidden whitespace-nowrap"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <span className="block text-sm font-bold tracking-tight text-slate-900 font-display truncate">
                  Campus Continuity
                </span>
                <span className="block text-[10px] font-medium text-emerald-700 truncate">
                  Preserve Knowledge
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Active Project Selector */}
        {!collapsed && (
          <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
                Active Workspace
              </span>
              <Link
                to="/projects"
                className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
              >
                Switch
              </Link>
            </div>
            {projects.length > 0 ? (
              <div className="relative">
                <select
                  aria-label="Select Active Project"
                  value={activeProjectId || ''}
                  onChange={(e) => setActiveProjectId(e.target.value)}
                  className="w-full appearance-none bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer truncate shadow-2xs"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            ) : (
              <button
                onClick={() => navigate('/projects')}
                className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                + New Project Workspace
              </button>
            )}
          </div>
        )}

        {/* Navigation Groups */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {(['WORKSPACE', 'INTELLIGENCE', 'SYSTEM'] as const).map((groupName) => {
            const items = NAV_ITEMS.filter((i) => i.group === groupName);
            return (
              <div key={groupName}>
                {!collapsed && (
                  <p className="px-3 mb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    {groupName}
                  </p>
                )}
                <div className="space-y-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    const badge = getBadgeCount(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        title={collapsed ? item.label : undefined}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                        }`}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              isActive ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                          />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </span>
                        {!collapsed && badge !== null && (
                          <span
                            className={`text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded-md ${
                              isActive
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User Profile at Bottom of Sidebar */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/40">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-90 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                {userInitials}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {userProfile?.displayName || user?.email?.split('@')[0] || 'Platform User'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {userProfile?.jobTitle || 'Enterprise Member'}
                  </p>
                </div>
              )}
            </button>
            {!collapsed && (
              <button
                onClick={handleSignOut}
                title="Sign Out"
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-xs bg-white text-slate-900 h-full flex flex-col z-10 shadow-xl">
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
                  <Layers className="w-4 h-4" />
                </div>
                <span className="text-base font-bold text-slate-900 font-display">
                  Campus Continuity
                </span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {projects.length > 0 && (
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Active Workspace
                </label>
                <select
                  value={activeProjectId || ''}
                  onChange={(e) => {
                    setActiveProjectId(e.target.value);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-3 py-2"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-100">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 text-white text-xs font-semibold rounded-xl"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Shell */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          collapsed ? 'lg:pl-[76px]' : 'lg:pl-[260px]'
        }`}
      >
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Left: Mobile Menu + Breadcrumb Navigation */}
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg"
              aria-label="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap">
              <span className="text-slate-400 font-medium hidden sm:inline">Workspace</span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-slate-700">
                {activeProject ? activeProject.code : 'All Projects'}
              </span>
              <span className="text-slate-300" aria-hidden="true">
                /
              </span>
              <span className="font-bold text-slate-900">{currentNav.label}</span>
            </div>
          </div>

          {/* Center: Global Search */}
          <div className="relative flex-1 max-w-md mx-2">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 180)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                placeholder="Search projects, documents, decisions, tasks..."
                className="w-full pl-9 pr-12 py-2 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs text-slate-800 rounded-xl border border-transparent focus:border-emerald-500 focus:outline-none transition-all"
              />
              <span className="hidden sm:inline-block absolute right-2.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white rounded border border-slate-200">
                ⌘K
              </span>
            </div>

            {/* Live Global Search Popover */}
            {searchOpen && searchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden z-50">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-500">
                  Search Results ({searchResults.length})
                </div>
                {searchResults.length === 0 ? (
                  <div className="p-4 text-xs text-slate-500 text-center">
                    No matching projects, documents, or extracted findings for "{searchQuery}".
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {searchResults.map((res) => (
                      <button
                        key={res.id}
                        type="button"
                        onMouseDown={() => {
                          if (res.projectId) setActiveProjectId(res.projectId);
                          navigate(res.path);
                          setSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-emerald-50/50 flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{res.title}</p>
                          <p className="text-[11px] text-slate-500 truncate">{res.subtitle}</p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Notifications, Help, Profile Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Notifications Button & Popover */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen(!notifOpen);
                  setProfileOpen(false);
                }}
                className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="Activity Notifications"
              >
                <Bell className="w-4 h-4" />
                {allActivities.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden z-50">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Recent Workspace Activity</span>
                    <button
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-slate-400 hover:text-slate-700"
                    >
                      Close
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {allActivities.length === 0 ? (
                      <p className="p-4 text-xs text-slate-500 text-center">
                        No recent notifications yet.
                      </p>
                    ) : (
                      allActivities.slice(0, 6).map((act) => (
                        <div key={act.id} className="p-3 text-xs hover:bg-slate-50">
                          <p className="font-semibold text-slate-900">{act.projectName}</p>
                          <p className="text-slate-600 mt-0.5 line-clamp-2">{act.summary}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Help Button */}
            <button
              onClick={() => setHelpOpen(true)}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Platform Guide & Help"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* User Avatar & Profile Dropdown */}
            <div className="relative pl-2 border-l border-slate-200">
              <button
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2.5 py-1 px-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {userInitials}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[120px]">
                    {userProfile?.displayName || user?.email?.split('@')[0] || 'User'}
                  </p>
                  <p className="text-[10px] text-slate-500 leading-tight truncate max-w-[120px]">
                    {user?.email}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-lg py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {userProfile?.displayName || 'Authenticated User'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/settings');
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>Profile & Settings</span>
                  </button>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/assistant');
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <Bot className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Ask AI Assistant</span>
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-5 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Help Modal */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-2xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 font-display">
                  Campus Continuity Workflow Guide
                </h3>
              </div>
              <button
                onClick={() => setHelpOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                <strong className="text-slate-900">1. Create a Project Workspace:</strong> Set up the project metadata, departing member, incoming member, and target handover date.
              </p>
              <p>
                <strong className="text-slate-900">2. Upload Authorised Documents:</strong> Upload PDF, DOCX, TXT, or Markdown artifacts—or load our 3-document sample pack to test immediately.
              </p>
              <p>
                <strong className="text-slate-900">3. Run Gemini AI Reconstruction:</strong> Extract decisions, completed vs. unfinished tasks, owners, risks, dependencies, and contradictions with verbatim source quotes.
              </p>
              <p>
                <strong className="text-slate-900">4. Human-in-the-Loop Review:</strong> Verify source citations, edit inferred owners, and approve findings in the Knowledge Review workspace.
              </p>
              <p>
                <strong className="text-slate-900">5. Generate Role-Specific Handover PDF:</strong> Synthesize a tailored handover report for Engineering, Product, SRE, or Executives and download as PDF.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setHelpOpen(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
