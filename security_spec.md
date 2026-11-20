# Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Default Deny**: All paths not explicitly matched in `/databases/{database}/documents` are denied (`allow read, write: if false;`).
2. **Verified Identity**: All write operations require `request.auth != null && request.auth.token.email_verified == true`.
3. **PII Isolation (`users/{userId}`)**: User profiles contain `email`, `displayName`, `jobTitle`, and `department`. Only the owner (`request.auth.uid == userId`) or a verified admin (`isAdmin()`) can `get`, `create`, or `update` their user document. `list` and `delete` on `/users` are strictly prohibited to prevent directory scraping.
4. **Relational Consistency (Master Gate)**: Every child entity (`projectMembers`, `documents`, `extractedKnowledge`, `decisions`, `tasks`, `risks`, `dependencies`, `reviews`, `handovers`, `activityLogs`) must reference an existing parent project via `projectId` (`exists(/databases/$(database)/documents/projects/$(incoming().projectId))`) owned by `request.auth.uid`.
5. **Immutable Ownership & Timestamps**: `ownerId`, `projectId`, and `createdAt` can never be mutated during an `update`. All `create` operations must set `createdAt == request.time`, and all `update` operations must set `updatedAt == request.time`.
6. **Strict Schema & Size Boundaries**: Every `create` and `update` must pass `isValid[Entity](incoming())`, which validates exact keys (`hasAll` and `hasOnly`), field types, enums, regex ID patterns (`^[a-zA-Z0-9_\-]+$`), and string length limits.
7. **Secure List Enforcer**: Every `allow list` rule evaluates `resource.data.ownerId == request.auth.uid` directly without performing `get()` or `exists()` lookups.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts to create a `projects` document.
2. **Shadow Field Injection**: Authenticated owner sends `isAdmin: true` or `ghostField: "hack"` inside a `projects` create payload.
3. **Cross-Tenant Identity Spoofing**: Authenticated user `user_A` attempts to create a `projects` document with `ownerId: "user_B"`.
4. **Orphaned Sub-Entity Write**: Authenticated user attempts to create a `decisions` document with a `projectId` that does not exist in `/projects`.
5. **Cross-Tenant Sub-Entity Write**: Authenticated user `user_A` attempts to create a `tasks` document pointing to `user_B`'s `projectId`.
6. **PII Directory Scraping**: Authenticated user attempts to run a `list` query on `/users` or `get` `/users/other_user_id`.
7. **Timestamp Forgery**: Authenticated owner attempts to create a `documents` record with a backdated client timestamp instead of `request.time`.
8. **Immutable Ownership Mutation**: Authenticated owner attempts to `update` a `projects` document and change `ownerId` or `createdAt`.
9. **Update-Gap Value Poisoning**: Authenticated owner updates an allowed key (`status`) on `projects` with an invalid enum value (`"hacked_status"`) or a 50KB string.
10. **ID Poisoning Attack**: Attacker attempts to create a document with a 500-character ID or special path characters.
11. **Terminal State Modification**: Attacker attempts to update a `projects` document after its `status` has reached `"archived"`, or modify an immutable `reviews` audit log.
12. **Blanket List Query Scraping**: Authenticated user attempts to `list` `/decisions` or `/handovers` without filtering `ownerId == request.auth.uid`.
