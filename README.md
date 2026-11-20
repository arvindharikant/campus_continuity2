# Campus Continuity — AI-Powered Academic Project Knowledge & Handover Platform

> **Tagline:** *Preserve Knowledge. Continue Innovation.*  
> **Core Statement:** *"Campus Continuity ensures that no academic project loses its knowledge when its students leave."*

---

## 1. Product Overview

**Campus Continuity** prevents academic and technical project knowledge loss when students graduate, change teams, or leave ongoing capstone and research lab projects. It collects authorized project documents, extracts structured project intelligence using **Google Gemini**, detects missing knowledge and risks, calculates a transparent **100-point Project Continuity Score**, enables grounded Q&A (**Ask Your Project**), and generates multi-page **PDF Handover Packages** for incoming students and team members.

---

## 2. The 7 Core Campus Continuity Features

### Feature 1 — AI Document Intelligence System (`/documents`)
- **Multi-Format Upload**: Drag-and-drop or browse for `.pdf`, `.docx`, `.txt`, and `.md` project documents.
- **Validation & Deduplication**:
  - File type & 10 MB size limit validation.
  - Empty file detection (`0 bytes` or empty text rejected).
  - Duplicate upload detection within the same project workspace.
  - Scanned PDF warning badge when a PDF contains minimal embedded text streams without OCR.
- **11-Point AI Document Intelligence Inspector**: Click **AI Summary & Text** on any uploaded document to inspect its Overview, Project Objectives, Technologies Mentioned, System Architecture, Completed Activities, Pending Activities, Technical Decisions, Known Problems, Dependencies, Future Recommendations, and Handover Summary alongside the raw extracted text.

### Feature 2 — AI Task & Decision Extraction and Management (`/review`)
- **Dedicated Views**: Separate filter tabs for **All Findings**, **All Tasks**, **Completed Tasks**, **Pending Tasks**, **Important Decisions**, and **Risks & Dependencies**.
- **Human-in-the-Loop Verification**: AI-extracted items are marked **Requires Human Verification** until approved by a human reviewer.
- **Manual & AI Task/Decision Management**:
  - Toggle tasks between **Completed** and **Pending** with one click.
  - Edit task owners, priorities, statuses, and decision rationales.
  - **Add Manual Task** (`+ Add Task`) and **Add Manual Decision** (`+ Add Decision`) directly to the project database.
  - Inspect verbatim source quotes and full document context.

### Feature 3 — Persistent Project Handover Workspace (`/projects`)
- **Full Database Persistence**: Powered by **Cloud Firestore** (`ai-studio-41bc25ef-e662-41f4-9704-c9193a6da2e8`) and **Firebase Authentication** with Zero-Trust ABAC security rules (`firestore.rules`).
- **Project Isolation**: All documents, extracted knowledge, tasks, decisions, risks, dependencies, review logs, and handover reports persist across browser refreshes and server restarts.

### Feature 4 — Ask Your Project — AI Knowledge Assistant (`/assistant`)
- **Grounded Q&A**: Answers natural-language questions strictly from the selected project's uploaded documents, extracted tasks, decisions, and risks.
- **10 Suggested Academic Project Questions**: Includes *"What is this project about?"*, *"What work has already been completed?"*, *"What tasks are still pending?"*, *"Why was this database or architecture chosen?"*, *"Who worked on which module?"*, *"What should the next team do first?"*, and *"Summarize the complete handover for a new student."*
- **Zero-Hallucination Fallback**: Explicitly responds with `"I could not find sufficient information in the available project records to answer this confidently."` when evidence is absent.

### Feature 5 — AI Project Continuity Score (`/`, `/analytics`)
- **Transparent 100-Point Formula**:
  1. **Documentation Completeness (25 pts)**: Project description (+5), departing/incoming leads & target date (+5), 1+ doc uploaded (+5), 2+ docs uploaded (+5), all docs AI-analyzed (+5).
  2. **Task Tracking Completeness (20 pts)**: Tasks recorded (+5), all pending tasks have assigned owners (+5), completed work verified (+5), >=50% tasks human-approved (+5).
  3. **Decision Documentation (20 pts)**: Decisions recorded (+5), all decisions include rationale (+5), >=50% decisions have source quotes (+5), >=50% decisions human-approved (+5).
  4. **Risk & Blocker Management (20 pts)**: Risks/dependencies cataloged (+5), critical/high risks have mitigation plans (+5), 0 blocked tasks (+5), >=50% risks resolved/approved (+5).
  5. **Handover Readiness (15 pts)**: Executive summary & next actions generated (+5), handover report generated (+5), handover report approved & published (+5).
- **Explainable Deductions**: Displays exact point deductions and one-click improvement recommendations.

### Feature 6 — Knowledge Gap & Risk Detector (`/risks`)
- Automatically detects unassigned pending tasks, decisions missing rationale, unresolved blockers, undocumented dependencies, missing setup instructions, and cross-document contradictions.
- Classifies items into **Critical**, **High**, **Medium**, and **Low** severity.
- Displays summary counters (**Total Identified Risks & Gaps**, **Critical Risks**, **Unresolved Risks**, **Resolved Risks**) and lets users update mitigation plans, assign owners, log manual risks, or **Mark as Resolved**.

### Feature 7 — Automatic Handover Report Generator (`/handover`)
- **Pre-Generation Readiness Check**: Displays a 6-point completeness checklist and warns about missing documentation or unassigned tasks before generation while still allowing report synthesis (labeling unavailable fields `"Not documented"`).
- **Professional Multi-Page PDF Export**: Includes cover banner, Table of Contents, Continuity Score badge, structured sections, and page numbers.

---

## 3. Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS 4, React Router 7, Lucide Icons, jsPDF
- **Backend API**: Node.js + Express (`server.ts`) with native PDF FlateDecode stream & text operator extraction, Mammoth DOCX extraction, and resilient multi-model Gemini cascade
- **AI Engine**: Google Gemini API (`@google/genai` SDK running strictly server-side)
- **Database & Auth**: Firebase Authentication (Google Sign-In & Email/Password) + Cloud Firestore (`firestore.rules`)

---

## 4. Environment Variables

Create a `.env` file based on `.env.example`:

```env
GEMINI_API_KEY="your_google_gemini_api_key"
APP_URL="http://localhost:3000"
PORT=3000
```

> **Security Note:** `GEMINI_API_KEY` is read exclusively by the backend server (`server.ts`) and is never exposed in client-side `VITE_` variables.

---

## 5. Running Locally & Building for Production

```bash
# 1. Install dependencies
npm install

# 2. Start the full-stack development server on http://localhost:3000
npm run dev

# 3. Type-check and build production assets
npm run lint
npm run build
```
