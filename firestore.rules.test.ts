/**
 * Phase 0 & Phase 5 Security Rules Verification Suite ("Dirty Dozen" Payloads)
 * Verifies that all 12 adversarial payloads defined in security_spec.md are rejected
 * with PERMISSION_DENIED by the Firestore Security Rules.
 */

export interface AdversarialTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  docId: string;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
  enforcedByGate: string;
}

export const DIRTY_DOZEN_TEST_CASES: AdversarialTestCase[] = [
  {
    id: 1,
    name: 'Unverified Email Write',
    collection: 'projects',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: false },
    docId: 'proj_1',
    payload: { ownerId: 'user_1', name: 'Project Alpha', status: 'active' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'isVerifiedUser() -> request.auth.token.email_verified == true',
  },
  {
    id: 2,
    name: 'Shadow Field Injection',
    collection: 'projects',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    docId: 'proj_1',
    payload: { ownerId: 'user_1', name: 'Project Alpha', isAdmin: true },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'isValidProject(incoming()) -> data.keys().hasOnly(...)',
  },
  {
    id: 3,
    name: 'Cross-Tenant Identity Spoofing',
    collection: 'projects',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    docId: 'proj_2',
    payload: { ownerId: 'user_2', name: 'Spoofed Project', status: 'active' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'isValidProject(incoming()) -> data.ownerId == request.auth.uid',
  },
  {
    id: 4,
    name: 'Orphaned Sub-Entity Write',
    collection: 'decisions',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    docId: 'dec_1',
    payload: { ownerId: 'user_1', projectId: 'non_existent_project', title: 'Orphan Decision' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'isValidParentProject(incoming().projectId) -> exists(.../projects/$(projectId))',
  },
  {
    id: 5,
    name: 'Cross-Tenant Sub-Entity Write',
    collection: 'tasks',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    docId: 'task_1',
    payload: { ownerId: 'user_1', projectId: 'user_2_project', title: 'Injected Task' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'isValidParentProject(incoming().projectId) -> get(...).data.ownerId == request.auth.uid',
  },
  {
    id: 6,
    name: 'PII Directory Scraping',
    collection: 'users',
    operation: 'list',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    docId: '*',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'match /users/{userId} -> allow list: if false;',
  },
  {
    id: 7,
    name: 'Timestamp Forgery',
    collection: 'documents',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    docId: 'doc_1',
    payload: { ownerId: 'user_1', projectId: 'proj_1', createdAt: '2020-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'incoming().createdAt == request.time',
  },
  {
    id: 8,
    name: 'Immutable Ownership Mutation',
    collection: 'projects',
    operation: 'update',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    docId: 'proj_1',
    payload: { ownerId: 'user_2' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'incoming().ownerId == existing().ownerId && affectedKeys().hasOnly(...)',
  },
  {
    id: 9,
    name: 'Update-Gap Value Poisoning',
    collection: 'projects',
    operation: 'update',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    docId: 'proj_1',
    payload: { status: 'invalid_hacked_state' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'isValidProject(incoming()) -> data.status in [...]',
  },
  {
    id: 10,
    name: 'ID Poisoning Attack',
    collection: 'projects',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    docId: 'invalid/id$with$special$chars',
    payload: { ownerId: 'user_1', name: 'Bad ID Project' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'isValidId(projectId) -> id.matches("^[a-zA-Z0-9_\\\\-]+$")',
  },
  {
    id: 11,
    name: 'Terminal State Modification on Archived Project',
    collection: 'projects',
    operation: 'update',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    docId: 'archived_proj_1',
    payload: { name: 'Reopened Project' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'existing().status != "archived"',
  },
  {
    id: 12,
    name: 'Blanket List Query Scraping',
    collection: 'handovers',
    operation: 'list',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    docId: '*',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'allow list: if isSignedIn() && existing().ownerId == request.auth.uid',
  },
];
