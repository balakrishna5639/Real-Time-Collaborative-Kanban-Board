from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from agent import KanbanAgent

app = FastAPI(
    title="Kanban Agentic AI Service",
    description="Intelligent context-aware assistant for multi-tenant collaborative boards",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    query: str
    tenantId: str
    tenantName: Optional[str] = "Current Branch"
    userId: Optional[str] = None
    userName: Optional[str] = "Team Member"

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Python Agentic AI Service",
        "version": "1.0.0"
    }

@app.post("/api/agent/chat")
def chat_with_agent(req: ChatRequest):
    if not req.tenantId:
        raise HTTPException(status_code=400, detail="tenantId context is strictly required")
    
    agent = KanbanAgent(
        tenant_id=req.tenantId,
        tenant_name=req.tenantName,
        user_name=req.userName
    )
    result = agent.run(req.query)
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

