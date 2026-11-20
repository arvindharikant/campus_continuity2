/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import DocumentsPage from './pages/DocumentsPage';
import AiReconstructionPage from './pages/AiReconstructionPage';
import KnowledgeReviewPage from './pages/KnowledgeReviewPage';
import RisksPage from './pages/RisksPage';
import HandoverPage from './pages/HandoverPage';
import AiAssistantPage from './pages/AiAssistantPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';

function AppRoutes() {
  const { user, loadingAuth } = useAppContext();

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F6F9] text-slate-900">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-medium text-slate-600">
            Initializing Campus Continuity Platform...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/reconstruction" element={<AiReconstructionPage />} />
        <Route path="/review" element={<KnowledgeReviewPage />} />
        <Route path="/risks" element={<RisksPage />} />
        <Route path="/handover" element={<HandoverPage />} />
        <Route path="/assistant" element={<AiAssistantPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}
