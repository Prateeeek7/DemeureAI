# Demeure AI: Intelligent Campus Infrastructure 🏢

> **Built for WebForge - A Smart Campus Webathon - 2026**
> 
> *A unified, intelligent campus management platform integrating real-time telemetry, AI-driven rulebook assistance, welfare tracking, and security operations.*

---

## 🌟 Overview
**Demeure AI** is an advanced hostel and campus management prototype designed to solve institutional administrative bottlenecks. It leverages modern web technologies and AI to provide role-specific dashboards for **Administrators, Wardens, Mess Managers, and Students**. 

From dynamically generating monthly power bills based on simulated ML telemetry, to answering student queries using an embedded RAG (Retrieval-Augmented Generation) pipeline, Demeure AI aims to bring total institutional excellence.

---

## 🚀 Key Features

### 1. 🤖 AI Handbook RAG (Virtual Assistant)
- **Natural Language Querying**: Students and staff can ask complex questions about campus rules (curfew, mess timings, visitor policies).
- **Vector Search Engine**: Powered by a Python/FastAPI backend using `sentence-transformers` to search through massive datasets of bureaucratic rulebooks instantly.

### 2. ⚡ Power Grid Diagnostics & Billing
- **Real-Time Telemetry**: Simulates real-time current load monitoring across different blocks.
- **Dynamic Utility Billing**: Admins can update power rates and dispatch bills instantly. Student portals update their "Outstanding Dues" in real-time based on actual consumption metrics.

### 3. 🛡️ Security SOC Gate (Visitor Management)
- **Visitor Pre-Authorization**: Students request visitor passes; Admins/Wardens approve them to conceptually generate temporary QR codes.
- **Cryptographic Ledger**: A tamper-proof UI log of all gate entries and exits simulating robust institutional security.

### 4. 🛏️ Resident Welfare Operations
- **Leave of Absence Management**: Students apply for leaves directly from their dashboard. Wardens review, approve, or deny them in real-time.
- **Anomaly Detection Desk**: Highlights anomalous student behavior (e.g., zero mess logs, absenteeism) for early welfare intervention.

### 5. 💳 Dedicated Student Services
- A unified view where students can monitor their total payable hostel fees, electricity overages, and mess fines, along with requesting leaves.

---

## 💻 Technology Stack

### Frontend
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS (Custom Design System with deep Navy, Warm Ivory, and Charcoal themes)
- **Charts**: Recharts (for telemetry and power diagnostics)
- **Icons**: Lucide React

### Backend
- **Framework**: Python + FastAPI (running on port `8001`)
- **AI/ML**: `sentence-transformers` (`all-MiniLM-L6-v2`) + PyTorch for text embeddings and semantic search.
- **State Management**: In-memory global state simulating a live database for real-time visitor, billing, and leave synchronization.

---

## 🛠️ How to Run Locally

To get the full real-time experience of Demeure AI, you must run both the Frontend and the Backend servers.

### 1. Start the Backend (FastAPI + AI)
The backend requires Python and handles the RAG vector engine as well as the simulated live database for billing/leaves.

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### 2. Start the Frontend (React + Vite)
Open a **new** terminal window:

```bash
npm install
npm run dev
```

The frontend will start (usually on `http://localhost:5175`). 

### 3. Testing the Application & Access Credentials
- Open the application in your browser (`http://localhost:5175`).
- Click **Access Core Command** to view the interactive Role Selection Matrix.
- Use the following test credentials to authenticate into the system:
  - **Resident Student**:
    - Email: `webforge@mit.edu`
    - Access Code: `MIT1122`
  - **Administrator**:
    - Hardware PIN: `0000-0000-0000`
  - **Hostel Warden**:
    - Hardware PIN: `1111-1111-1111`
  - **Mess Manager**:
    - Hardware PIN: `2222-2222-2222`
- **Try it out:** Submit a leave request as a Student, then switch to Warden and approve it. Notice the instant synchronization!

---
*Developed by Pratik Kumar for WebForge 2026.*
