# Demeure AI: Intelligent Campus Infrastructure 🏢

> **Intelligent campus operating system for hostels and universities**
> 
> *A unified, intelligent campus management platform integrating real-time telemetry, AI-driven rulebook assistance, resident welfare tracking, security operations, and a production-ready AWS cloud integration system.*

---

## 🌟 Overview
**Demeure AI** is an advanced hostel and campus management portal designed to solve institutional administrative bottlenecks. It leverages modern web technologies and AI to provide role-specific dashboards for **Administrators, Wardens, Mess Managers, and Students**.

From dynamically generating monthly power bills based on simulated ML telemetry, to answering student queries using an embedded RAG (Retrieval-Augmented Generation) pipeline, Demeure AI aims to bring total institutional excellence. In its latest update, Demeure AI integrates **four major AWS cloud services** with a fallback design that permits testing both on live cloud infrastructure and via a fully simulated local interface.

---

## 🚀 Core Subsystem Features

### 1. 🤖 AI Handbook RAG (Virtual Assistant)
- **Natural Language Querying**: Students and staff can ask complex questions about campus rules (curfew, mess timings, visitor policies).
- **Vector Search Engine**: Powered by a Python/FastAPI backend using `sentence-transformers` to search through datasets of bureaucratic rulebooks instantly.
- **Amazon Polly Voice Synthesis**: Integrates a speaker icon next to replies, allowing users to listen to handbook responses.

### 2. ⚡ Power Grid Diagnostics & Billing
- **Real-Time Telemetry**: Simulates real-time current load monitoring across different blocks.
- **Dynamic Utility Billing**: Admins can update power rates and dispatch bills instantly. Student portals update their "Outstanding Dues" in real-time based on actual consumption metrics.

### 3. 🛡️ Security SOC Gate (Visitor Management)
- **Visitor Pre-Authorization**: Students request visitor passes; Wardens approve them to generate temporary QR codes.
- **Cryptographic Ledger**: A tamper-proof UI log of all gate entries and exits simulating robust institutional security.

### 4. 🛏️ Resident Welfare Operations
- **Leave of Absence Management**: Students apply for leaves directly from their dashboard, uploading supporting files. Wardens review, approve, or deny them in real-time.
- **Anomaly Detection Desk**: Highlights anomalous student behavior (e.g., zero mess logs, absenteeism) for early welfare intervention.

### 5. 💳 Dedicated Student Services
- A unified view where students can monitor their total payable hostel fees, electricity overages, and mess fines, along with requesting leaves and uploading travel/medical proof.

---

## ☁️ AWS Cloud Integrations (Hybrid Mock/Live Architecture)

Demeure AI is engineered to run in a **hybrid mode**. It automatically detects whether AWS credentials are set in the `.env` file. If credentials are missing, it switches to **Mock Local Mode** records persist to a local SQLite database, files are stored on local disk, and every simulated call is shown in the administrative log console.

### 1. Amazon DynamoDB (NoSQL Storage)
- **Feature**: Every module persists to one DynamoDB table per collection (`demeure-leaves`, `demeure-visitors`, `demeure-billing`, `demeure-surveys`, `demeure-complaints`, …).
- **Auto-Provisioning**: A table is created on first use (on-demand billing) if it does not already exist.
- **Mock Fallback**: Uses a durable local SQLite database (`DATA_DIR/demeure.db`), so data survives restarts.

### 2. Amazon S3 (Asset Bucket)
- **Feature**: Private storage for student document attachments (travel tickets, medical certificates) uploaded with leave requests.
- **Upload Flow**: Files go to `/api/aws/s3/upload` (PDF/PNG/JPG only, content-checked, 5 MB limit) and are stored **privately**. They are served through `/api/files/<key>`, which only lets the uploader and hostel/campus staff open them (live mode redirects to a 5-minute pre-signed S3 URL).
- **Mock Fallback**: Saves files to `DATA_DIR/uploads` on local disk.

### 3. Amazon SES (Simple Email Service)
- **Feature**: Dispatches automated email notifications on critical workflow changes.
- **Triggers**:
  - Notifies the student's guardian (from the account's guardian email) when a leave is submitted.
  - Emails the student when a leave or visitor pass is approved or denied.
  - All user-supplied text is HTML-escaped before it goes into an email.
- **Mock Fallback**: Logs SES dispatch attempts directly to the Admin console.

### 4. Amazon Polly (Text-to-Speech)
- **Feature**: Synthesizes text answers from the AI RAG handbook assistant into high-quality MP3 audio streams.
- **Voice Options**: Supports customized Voice IDs including *Joanna* (US Female) and *Matthew* (US Male).
- **Mock Fallback**: Automatically falls back to the browser-native HTML5 `SpeechSynthesis` API in the frontend so text-to-speech still functions.

### 5. AWS Operations Control Hub
- **Feature**: A dedicated Admin tab displaying connectivity checkers, region specs, and an interactive testing dashboard.
- **SDK Log Terminal**: Intercepts and polls backend AWS SDK actions every 3 seconds to print a colored console feed of active cloud/mock events.

---

## 💻 Technology Stack

### Frontend
- **Framework**: React 19 + TypeScript + Vite (route-level code splitting; ~76 kB gzipped first load)
- **Styling**: Tailwind CSS · **Icons**: Lucide React · **Charts**: Recharts · **Excel**: SheetJS 0.20.3

### Backend
- **Framework**: Python 3.10 + FastAPI, organised into routers (`auth`, `hostel`, `campus`, `billing`, `aws`, `chat`)
- **Storage**: Pluggable document store: SQLite locally, DynamoDB when AWS credentials are present
- **AI/ML**: `sentence-transformers` (`all-MiniLM-L6-v2`) retrieval + Groq (`GROQ_MODEL`, default `openai/gpt-oss-20b`) or Gemini synthesis; weighted-similarity roommate matching; rule-based complaint triage
- **Cloud**: `boto3` for S3, SES, Polly, DynamoDB

### Security model
- Resident personal data (mobile, date of birth, blood group, guardian details, home address, medical notes) is encrypted at rest with AES-256-GCM; each ciphertext is bound to its record and field. Staff see masked numbers in the directory, opening a full profile is written to the audit log, and resident sign-in codes are stored only as PBKDF2 hashes.
- Server-side authentication: salted PBKDF2 credential hashes, HMAC-signed session tokens in an `HttpOnly`, `SameSite=Strict` cookie, login throttling (10 failures / 5 min).
- Every API route enforces the caller's role; students only ever see their own leaves, visitors, surveys, complaints and grievances. Anonymous grievances never expose the filer to staff.
- Amounts are computed on the server (clients cannot set what they pay); uploads are type-, size- and content-checked; all email HTML is escaped.
- Production mode refuses to start with a weak `SECRET_KEY` or demo PINs, hides the API docs, and sends CSP/HSTS/frame-deny headers.
- The gate ledger is a real SHA-256 hash chain; the UI shows whether the chain still verifies.

---

## 🛠️ Run Locally (development)

### 1. Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env        # optional: add GROQ_API_KEY / AWS keys
uvicorn main:app --reload --port 8001
```
The first start downloads the embedding model (~90 MB). The assistant reports `loading` until it is ready; every other module works immediately. Demo data is seeded once into `backend/data/runtime/demeure.db`: **100 resident students** (from `data/student_survey_100.xlsx`) with encrypted personal details, room assignments in their preferred block, survey responses, payments, leaves, visitor passes, complaints, grievances, mess reviews and gate-ledger entries that all refer to those residents. Delete that folder to reset.

### 2. Frontend (new terminal)
```bash
npm install
npm run dev
```
Open `http://localhost:5173`. Vite proxies `/api` to the backend on port 8001.

### 3. Tests and checks
```bash
cd backend && python -m pytest -q        # 31 API + domain tests
npm run lint && npm run build             # zero lint errors, type-checked build
```
CI runs the same checks on every push (`.github/workflows/ci.yml`).

---

## 🚀 Deploy to Production

One container serves both the API and the built React app (same origin, so the session cookie just works).

```bash
cp backend/.env.example backend/.env
# Set in backend/.env:
#   APP_ENV=production
#   SECRET_KEY=<python -c "import secrets; print(secrets.token_urlsafe(48))">
#   DATA_ENCRYPTION_KEY=<32 random bytes, base64; see .env.example>
#   CAMPUS_ADMIN_PIN / HOSTEL_ADMIN_PIN / MESS_MANAGER_PIN = your own 12-digit PINs
#   STUDENT_ACCOUNTS=email|code|Full Name|Room|guardian@email;...
#   (optional) GROQ_API_KEY, AWS_* keys
docker compose up -d --build
```
- Serve it behind HTTPS (cookies are `Secure` in production). For a plain-HTTP local trial, set `COOKIE_SECURE=false`.
- Data lives in the `demeure-data` volume (SQLite + uploads) unless AWS credentials switch it to DynamoDB/S3.
- Health probe: `GET /api/health` (also wired as the container `HEALTHCHECK`).
- `SEED_DEMO_DATA` defaults to **off** in production; set it to `true` for a demo deployment.

See `backend/.env.example` for every setting.

---

## 🔑 Demo Access (development / demo deployments only)

These defaults apply only when `APP_ENV` is not `production`, and the login screen only shows the hints in development builds (or when built with `VITE_SHOW_DEMO_CREDENTIALS=true`).

| Persona | Sign-In Identifier | Access Key / PIN | Lands on |
| :--- | :--- | :--- | :--- |
| **Campus Administrator** | — | `0000-0000-0000` | Overview, Academics, Facilities, Finance, Resident Directory, Power, AWS Hub |
| **Hostel Administrator / Warden** | — | `1111-1111-1111` | Resident Directory, Room Allocation, Survey ML Feed, Security SOC Gate, Welfare |
| **Mess Manager** | — | `2222-2222-2222` | Mess & Food Optimizer |
| **Resident Student** | `pratik2024@vit.student.ac.in` | `VIT2024` | Student Services, Survey, Complaints, Mess, Assistant |
| **Any of the 100 seeded residents** | e.g. `naveen.reddy@demeure.ac.in`, `arya.kumar@demeure.ac.in` (see *Resident Directory*) | `VIT2026` | Same as above, with their own room, dues and history |

---

## 📑 Demo Scenarios

1. **Leave with proof**: The student submits dates, reason and a PDF. The warden sees it under *Security SOC Gate*, opens the private attachment and approves it. The student's *My Applications* updates and the guardian/student emails appear in the AWS log.
2. **Visitor pass**: The student requests a pass under *Student Services*, the warden approves it, and the student sees a gate pass code (`GP-XXXXXX`).
3. **Billing cycle and payment**: The admin dispatches a new power rate (*Power Grid Diagnostics*). The student's statement recalculates on the server, they pay by UPI, and a receipt is stored. A new dispatch opens a new cycle.
4. **Survey to allocation**: The student completes the room survey and the warden sees it alongside the 100 seeded responses. *Room Allocation → Analyze Compatibility* ranks real matches, and allocation is capacity-checked and saved.
5. **Complaint triage**: The student describes an issue, triage assigns category, priority and SLA, and the warden moves it Open → Dispatched → Resolved.
6. **Handbook assistant**: Ask about curfew or visitor policy for a cited answer. The speaker icon reads it aloud (Polly, or browser speech in mock mode).
7. **Mess**: The manager uploads `data/DemeureAI_WeeklyMenu.xlsx`, which students see immediately. Student ratings appear in the manager's feedback feed.
8. **Anonymous grievance**: The student files anonymously, and admins can triage it without ever seeing who filed it.

A slide deck walking through these scenarios with screenshots is in `presentation/`.
