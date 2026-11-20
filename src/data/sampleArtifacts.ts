import { DocumentFileType } from '../types/models';

export interface SampleDocumentArtifact {
  fileName: string;
  fileType: DocumentFileType;
  fileSize: number;
  pageCount: number;
  extractedText: string;
}

/**
 * Realistic sample project artifact pack designed to demonstrate Gemini's ability
 * to extract verified decisions, distinguish completed vs. unfinished tasks,
 * detect contradictory deadlines/architecture notes, and flag missing credentials.
 */
export const SAMPLE_PROJECT_ARTIFACTS: SampleDocumentArtifact[] = [
  {
    fileName: 'ADR-014_Payment_Settlement_Architecture.pdf',
    fileType: 'pdf',
    fileSize: 284600,
    pageCount: 3,
    extractedText: `[Page 1]
ARCHITECTURE DECISION RECORD: ADR-014
Project: Horizon Cross-Border Settlement Engine (HZN-CORE)
Date: 2026-09-14
Author: Elena Rostova (Principal Systems Architect - Departing)
Status: Approved by Architecture Review Board

1. CONTEXT & PROBLEM STATEMENT
The legacy batch settlement processor experiences 14-minute latency spikes during European market close. To meet the new MAS & FCA regulatory SLA of sub-3-second settlement finality, we evaluated migrating the core ledger reconciliation service.

2. KEY ARCHITECTURAL DECISIONS
- Decision D-01: Adopt Cloud Spanner over self-managed PostgreSQL for multi-region ledger consistency.
  Rationale: Zero-downtime regional failover and external consistency guarantees without manual replication slots.
  Decision Maker: Elena Rostova & Marcus Vance (VP Engineering)
  Date Approved: 2026-09-14

- Decision D-02: Enforce Mutual TLS (mTLS) with SPIFFE/SPIRE across all settlement microservices.
  Rationale: Required for PCI-DSS 4.0 audit compliance scheduled for Q4.
  Decision Maker: Priya Nair (Security Lead)
  Date Approved: 2026-09-22

[Page 2]
3. IMPLEMENTATION PROGRESS & MILESTONES
- [COMPLETED] Provision Cloud Spanner instance in asia-east1 and europe-west1 (Completed on 2026-09-28 by Elena Rostova).
- [COMPLETED] Migrate FX Rate Ingestion Pipeline to Kafka consumer group v3 (Completed on 2026-10-05 by David Kim).
- [IN PROGRESS] Dual-write reconciliation shadow testing between legacy Postgres and Cloud Spanner. Currently at 65% traffic parity; edge cases with JPY zero-decimal rounding remain unresolved.
- [PENDING] Decommission legacy Postgres read-replicas in Frankfurt. Do NOT execute until shadow testing reaches 100% parity for 14 consecutive days.

[Page 3]
4. EXTERNAL DEPENDENCIES & KNOWN RISKS
- Dependency: ClearStream Banking SWIFT Gateway API v4.2 upgrade.
  Contact: Lukas Weber (clearstream-integration@partner-bank.example)
  Note: Production cutover scheduled for 2026-11-25 according to ADR-014.
- Risk R-01: Master HSM key rotation script has only been tested in staging. If the production hardware security module fails over during cutover, manual key ceremony requires two physical smartcards. Location of backup smartcard #2 is not documented in this ADR.`,
  },
  {
    fileName: 'Sprint_42_Exit_Handover_Notes_Elena.docx',
    fileType: 'docx',
    fileSize: 142800,
    pageCount: 2,
    extractedText: `HANDOVER MEMORANDUM – DEPARTING TECH LEAD
From: Elena Rostova (Departing Principal Architect, last day: 2026-11-20)
To: Incoming Engineering Lead & Platform Team
Date: 2026-11-08

1. CURRENT SPRINT STATUS & UNFINISHED WORK
- The JPY and KRW zero-decimal currency rounding bug in the Spanner shadow writer is still happening on ~0.04% of transactions. I started a patch in branch "fix/jpy-rounding-ledger" but have NOT merged or deployed it to staging yet. Someone needs to take ownership of this branch—no owner has been assigned yet.
- Load testing for Black Friday peak volume (12,000 TPS) is blocked because the staging Kubernetes cluster quota in asia-east1 was capped at 64 vCPUs by FinOps.
- Task Assigned to David Kim: Update Terraform state locks and migrate CI/CD service account keys before 2026-11-18.
- Task Assigned to Priya Nair: Complete penetration test sign-off report for the mTLS gateway.

2. CONTRADICTIONS / SCHEDULE UPDATES TO NOTE
- IMPORTANT SCHEDULE NOTE: Although ADR-014 listed the ClearStream SWIFT Gateway v4.2 cutover as 2026-11-25, ClearStream emailed us yesterday moving the mandatory cutover up to 2026-11-19. However, the Product Roadmap deck still shows 2026-12-05. We need urgent alignment with Lukas Weber on which date is contractually enforced.
- Also, in last week's retro notes, someone wrote that the Fraud Scoring Webhook uses Redis Cluster, but we actually deprecated Redis last month and moved velocity counters into memory-mapped RocksDB state stores.

3. OPEN QUESTIONS & MISSING DOCUMENTATION
- Where are the production PagerDuty escalation override tokens stored? When I took over from Tom in April, they were in a personal 1Password vault that was never migrated to the team vault.
- Who has signing authority for the Cloudflare Enterprise WAF custom ruleset changes once my account is deactivated on November 20?
- We still haven't decided whether failed dead-letter settlement events should auto-retry after 15 minutes or require manual treasury operator approval.`,
  },
  {
    fileName: 'Production_Risk_And_Compliance_Register.txt',
    fileType: 'txt',
    fileSize: 64200,
    pageCount: 1,
    extractedText: `HORIZON SETTLEMENT ENGINE - RISK & DEPENDENCY REGISTER
Last Updated: 2026-11-10

1. CRITICAL RISKS
- [CRITICAL] Single Point of Knowledge on Settlement Reconciliation CLI:
  Elena Rostova is currently the only engineer who has executed the manual End-of-Day (EOD) ledger reconciliation script ("reconcile-eod.sh"). There is no written runbook for handling split-brain settlement states.
  Mitigation Plan: Schedule recorded pair-shadowing session before November 18 and document every CLI flag in Confluence.

- [HIGH] FinOps Cloud Quota Freeze:
  Infrastructure team placed a hard freeze on asia-east1 GKE node pool autoscaling during Q4 budget audit, blocking the 12,000 TPS stress test required for production sign-off.
  Owner: Unassigned (Requires VP Engineering escalation to FinOps).

2. REGULATORY & TEAM DEPENDENCIES
- Regulatory Dependency: Monetary Authority of Singapore (MAS) Technology Risk Management (TRM) attestation packet must be submitted 5 business days prior to production traffic cutover.
  Owner Contact: Sarah Jenkins (Chief Compliance Officer, s.jenkins@enterprise.example)
  Status: At Risk (awaiting mTLS penetration test report from Priya Nair).`,
  },
];
