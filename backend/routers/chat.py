from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from deps import Services, current_user, get_services
from services.auth import SessionUser
from services.rag_service import MAX_QUERY_CHARS

router = APIRouter(prefix="/api/chat", tags=["assistant"])


class ChatRequest(BaseModel):
    query: str = Field(min_length=1, max_length=MAX_QUERY_CHARS)


class ChatResponse(BaseModel):
    text: str
    citations: list[str]


@router.post("/query", response_model=ChatResponse)
def chat_query(request: ChatRequest, services: Services = Depends(get_services),
               _: SessionUser = Depends(current_user)) -> ChatResponse:
    if not request.query.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Query cannot be empty")
    rag = services.rag
    if rag.status == "loading":
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            "The handbook assistant is still loading. Try again in a moment.")
    if not rag.ready:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "The handbook assistant is unavailable.")
    reply, citations = rag.query(request.query)
    return ChatResponse(text=reply, citations=citations)
