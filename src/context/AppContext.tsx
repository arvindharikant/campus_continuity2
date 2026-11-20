import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { ensureUserProfile } from '../services/firestoreService';
import {
  UserProfile,
  Project,
  ProjectMember,
  ProjectDocument,
  ExtractedKnowledge,
  Decision,
  TaskItem,
  RiskItem,
  DependencyItem,
  ReviewLog,
  HandoverReport,
  ActivityLog,
} from '../types/models';

interface AppContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  loadingAuth: boolean;
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;
  setActiveProjectId: (id: string | null) => void;
  allDocuments: ProjectDocument[];
  allDecisions: Decision[];
  allTasks: TaskItem[];
  allRisks: RiskItem[];
  allDependencies: DependencyItem[];
  allHandovers: HandoverReport[];
  allActivities: ActivityLog[];
  // Active project scoped items
  projectMembers: ProjectMember[];
  projectDocuments: ProjectDocument[];
  projectKnowledge: ExtractedKnowledge | null;
  projectDecisions: Decision[];
  projectTasks: TaskItem[];
  projectRisks: RiskItem[];
  projectDependencies: DependencyItem[];
  projectReviews: ReviewLog[];
  projectHandovers: HandoverReport[];
  projectActivities: ActivityLog[];
  refreshUserProfile: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const [allMembers, setAllMembers] = useState<ProjectMember[]>([]);
  const [allDocuments, setAllDocuments] = useState<ProjectDocument[]>([]);
  const [allKnowledge, setAllKnowledge] = useState<ExtractedKnowledge[]>([]);
  const [allDecisions, setAllDecisions] = useState<Decision[]>([]);
  const [allTasks, setAllTasks] = useState<TaskItem[]>([]);
  const [allRisks, setAllRisks] = useState<RiskItem[]>([]);
  const [allDependencies, setAllDependencies] = useState<DependencyItem[]>([]);
  const [allReviews, setAllReviews] = useState<ReviewLog[]>([]);
  const [allHandovers, setAllHandovers] = useState<HandoverReport[]>([]);
  const [allActivities, setAllActivities] = useState<ActivityLog[]>([]);

  const refreshUserProfile = async () => {
    const current = auth.currentUser;
    if (!current || !current.emailVerified) return;
    try {
      const profile = await ensureUserProfile(
        current.uid,
        current.email || 'user@enterprise.example',
        current.displayName || current.email?.split('@')[0] || 'Platform User'
      );
      setUserProfile(profile);
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
    }
  };

  useEffect(() => {
    let retryTimer: number | undefined;

    const handleOnlineRetry = () => {
      const current = auth.currentUser;
      if (current && current.emailVerified) {
        ensureUserProfile(
          current.uid,
          current.email || 'user@enterprise.example',
          current.displayName || current.email?.split('@')[0] || 'Platform User'
        )
          .then((profile) => setUserProfile(profile))
          .catch(() => {
            // Will retry on next network transition
          });
      }
    };

    window.addEventListener('online', handleOnlineRetry);

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (retryTimer) {
        window.clearTimeout(retryTimer);
        retryTimer = undefined;
      }

      setUser(firebaseUser);
      if (firebaseUser) {
        const fallbackProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || 'user@enterprise.example',
          displayName:
            firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Platform User',
          jobTitle: 'Team Member',
          department: 'Engineering',
          notifyOnReview: true,
          notifyOnHandover: true,
        };

        if (firebaseUser.emailVerified) {
          try {
            const profile = await ensureUserProfile(
              firebaseUser.uid,
              fallbackProfile.email,
              fallbackProfile.displayName
            );
            setUserProfile(profile);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            const isOffline =
              msg.toLowerCase().includes('offline') || msg.toLowerCase().includes('unavailable');
            if (isOffline) {
              // Keep UI usable with auth-derived profile and retry shortly
              setUserProfile(fallbackProfile);
              retryTimer = window.setTimeout(() => {
                handleOnlineRetry();
              }, 4000);
            } else {
              console.error('Profile initialization error:', err);
              setUserProfile(fallbackProfile);
            }
          }
        } else {
          setUserProfile({
            ...fallbackProfile,
            displayName: firebaseUser.displayName || 'Unverified User',
          });
        }
      } else {
        setUserProfile(null);
        setProjects([]);
        setActiveProjectId(null);
        setAllMembers([]);
        setAllDocuments([]);
        setAllKnowledge([]);
        setAllDecisions([]);
        setAllTasks([]);
        setAllRisks([]);
        setAllDependencies([]);
        setAllReviews([]);
        setAllHandovers([]);
        setAllActivities([]);
      }
      setLoadingAuth(false);
    });

    return () => {
      if (retryTimer) window.clearTimeout(retryTimer);
      window.removeEventListener('online', handleOnlineRetry);
      unsubAuth();
    };
  }, []);

  // Attach real-time Firestore listeners once user is authenticated
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    const subscribeOwned = <T extends { id: string; createdAt?: { seconds?: number } }>(
      colName: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>
    ) => {
      const q = query(collection(db, colName), where('ownerId', '==', uid));
      return onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as T);
          items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          setter(items);
        },
        (err) => {
          if (err?.code === 'unavailable') {
            console.warn(`Firestore listener temporarily unavailable for ${colName}; waiting to reconnect.`);
            return;
          }
          handleFirestoreError(err, OperationType.LIST, colName);
        }
      );
    };

    const unsubs = [
      subscribeOwned<Project>('projects', setProjects),
      subscribeOwned<ProjectMember>('projectMembers', setAllMembers),
      subscribeOwned<ProjectDocument>('documents', setAllDocuments),
      subscribeOwned<ExtractedKnowledge>('extractedKnowledge', setAllKnowledge),
      subscribeOwned<Decision>('decisions', setAllDecisions),
      subscribeOwned<TaskItem>('tasks', setAllTasks),
      subscribeOwned<RiskItem>('risks', setAllRisks),
      subscribeOwned<DependencyItem>('dependencies', setAllDependencies),
      subscribeOwned<ReviewLog>('reviews', setAllReviews),
      subscribeOwned<HandoverReport>('handovers', setAllHandovers),
      subscribeOwned<ActivityLog>('activityLogs', setAllActivities),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user]);

  // Keep activeProjectId synced with available projects
  useEffect(() => {
    if (projects.length > 0) {
      if (!activeProjectId || !projects.some((p) => p.id === activeProjectId)) {
        setActiveProjectId(projects[0].id);
      }
    } else {
      setActiveProjectId(null);
    }
  }, [projects, activeProjectId]);

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  const projectMembers = allMembers.filter((m) => m.projectId === activeProjectId);
  const projectDocuments = allDocuments.filter((d) => d.projectId === activeProjectId);
  const projectKnowledge = allKnowledge.find((k) => k.projectId === activeProjectId) || null;
  const projectDecisions = allDecisions.filter((d) => d.projectId === activeProjectId);
  const projectTasks = allTasks.filter((t) => t.projectId === activeProjectId);
  const projectRisks = allRisks.filter((r) => r.projectId === activeProjectId);
  const projectDependencies = allDependencies.filter((d) => d.projectId === activeProjectId);
  const projectReviews = allReviews.filter((r) => r.projectId === activeProjectId);
  const projectHandovers = allHandovers.filter((h) => h.projectId === activeProjectId);
  const projectActivities = allActivities.filter((a) => a.projectId === activeProjectId);

  return (
    <AppContext.Provider
      value={{
        user,
        userProfile,
        loadingAuth,
        projects,
        activeProjectId,
        activeProject,
        setActiveProjectId,
        allDocuments,
        allDecisions,
        allTasks,
        allRisks,
        allDependencies,
        allHandovers,
        allActivities,
        projectMembers,
        projectDocuments,
        projectKnowledge,
        projectDecisions,
        projectTasks,
        projectRisks,
        projectDependencies,
        projectReviews,
        projectHandovers,
        projectActivities,
        refreshUserProfile,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used inside an AppProvider.');
  }
  return ctx;
}
