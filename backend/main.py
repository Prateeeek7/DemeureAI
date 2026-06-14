from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv

# Load env variables (for GEMINI_API_KEY)
load_dotenv()

from services.rag_service import RAGService

app = FastAPI(title="Demeure AI Backend")

# Allow frontend to connect 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize RAG Service on startup
rag_service = None

@app.on_event("startup")
async def startup_event():
    global rag_service
    # Path is relative to the backend directory
    data_dir = os.path.join(os.path.dirname(__file__), "data", "rulebooks")
    rag_service = RAGService(data_dir=data_dir)

class ChatRequest(BaseModel):
    query: str

class ChatResponse(BaseModel):
    text: str
    citations: list[str]

@app.post("/api/chat/query", response_model=ChatResponse)
async def chat_query(request: ChatRequest):
    if not request.query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    try:
        reply, citations = rag_service.query(request.query)
        return ChatResponse(text=reply, citations=citations)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
def health_check():
    return {"status": "ok", "gemini_enabled": os.environ.get("GEMINI_API_KEY") is not None}

# --- REALTIME STATE MEMORY ---
# In a real app, this would be a database like PostgreSQL or Firestore.

state_billing = {
    "powerRate": 8.50,
    "baseFee": 75000
}

state_visitors = [
    { "id": 'V-001', "visitor": 'Suresh Kumar', "host": 'Pratik Kumar (RM-302)', "date": 'Today, 14:00', "purpose": 'Parental Visit', "status": 'Pending' },
    { "id": 'V-002', "visitor": 'Amit Patel', "host": 'Rahul Singh (RM-105)', "date": 'Tomorrow, 10:00', "purpose": 'Local Guardian', "status": 'Pending' },
]

state_leaves = [
    { "id": 'L-101', "name": 'Pratik Kumar', "room": 'RM-302', "duration": '3 Days (14 Jun - 17 Jun)', "reason": 'Hackathon Participation', "consent": 'Parent Verified (OTP)', "status": 'Pending' },
    { "id": 'L-102', "name": 'Dev Sharma', "room": 'RM-102', "duration": '1 Day (15 Jun)', "reason": 'Local Medical Checkup', "consent": 'Pending Parent Auth', "status": 'Pending' },
]

# --- BILLING ENDPOINTS ---
class BillingUpdate(BaseModel):
    powerRate: float

@app.get("/api/billing")
def get_billing():
    return state_billing

@app.post("/api/billing/update")
def update_billing(update: BillingUpdate):
    state_billing["powerRate"] = update.powerRate
    return state_billing

# --- VISITOR ENDPOINTS ---
@app.get("/api/visitors")
def get_visitors():
    return [v for v in state_visitors if v["status"] == "Pending"]

@app.post("/api/visitors/{visitor_id}/approve")
def approve_visitor(visitor_id: str):
    for v in state_visitors:
        if v["id"] == visitor_id:
            v["status"] = "Approved"
            return {"status": "success"}
    raise HTTPException(status_code=404, detail="Visitor not found")

@app.post("/api/visitors/{visitor_id}/deny")
def deny_visitor(visitor_id: str):
    for v in state_visitors:
        if v["id"] == visitor_id:
            v["status"] = "Denied"
            return {"status": "success"}
    raise HTTPException(status_code=404, detail="Visitor not found")

# --- LEAVES ENDPOINTS ---
class LeaveRequest(BaseModel):
    name: str
    room: str
    startDate: str
    endDate: str
    reason: str

@app.get("/api/leaves")
def get_leaves():
    return state_leaves

@app.post("/api/leaves/submit")
def submit_leave(request: LeaveRequest):
    new_leave = {
        "id": f"L-{100 + len(state_leaves) + 1}",
        "name": request.name,
        "room": request.room,
        "duration": f"{request.startDate} to {request.endDate}",
        "reason": request.reason,
        "consent": "Parent Verified (OTP)", # Mocked automatic consent for demo
        "status": "Pending"
    }
    state_leaves.insert(0, new_leave)
    return new_leave

@app.post("/api/leaves/{leave_id}/approve")
def approve_leave(leave_id: str):
    for l in state_leaves:
        if l["id"] == leave_id:
            l["status"] = "Approved"
            return {"status": "success"}
    raise HTTPException(status_code=404, detail="Leave not found")

@app.post("/api/leaves/{leave_id}/deny")
def deny_leave(leave_id: str):
    for l in state_leaves:
        if l["id"] == leave_id:
            l["status"] = "Denied"
            return {"status": "success"}
    raise HTTPException(status_code=404, detail="Leave not found")

