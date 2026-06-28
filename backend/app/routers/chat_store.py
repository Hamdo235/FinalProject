from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlmodel import select
from ..db.session import get_session
from sqlmodel import Session
from ..models.chat import Conversation, ChatMessage
from .llm_chat import OLLAMA_URL, MODEL  # reuse settings
import httpx
from fastapi.responses import StreamingResponse
import json

router = APIRouter(prefix="/llm", tags=["LLM Chat Store"])

class ConversationCreate(BaseModel):
    title: str

class MessageCreate(BaseModel):
    role: str
    content: str
    reply_with_llm: Optional[bool] = False

class ConversationUpdate(BaseModel):
    title: str

@router.post("/conversations", response_model=Conversation)
def create_conversation(body: ConversationCreate, session: Session = Depends(get_session)):
    conv = Conversation(title=body.title)
    session.add(conv)
    session.commit()
    session.refresh(conv)
    return conv

@router.get("/conversations", response_model=List[Conversation])
def list_conversations(session: Session = Depends(get_session)):
    res = session.exec(select(Conversation).order_by(Conversation.created_at.desc())).all()
    return res

@router.patch("/conversations/{conv_id}", response_model=Conversation)
def rename_conversation(conv_id: int, body: ConversationUpdate, session: Session = Depends(get_session)):
    conv = session.get(Conversation, conv_id)
    if not conv:
        raise HTTPException(404, "Conversation inconnue")
    conv.title = body.title
    session.add(conv)
    session.commit()
    session.refresh(conv)
    return conv

@router.delete("/conversations/{conv_id}")
def delete_conversation(conv_id: int, session: Session = Depends(get_session)):
    conv = session.get(Conversation, conv_id)
    if not conv:
        raise HTTPException(404, "Conversation inconnue")
    # supprimer les messages associés
    msgs = session.exec(select(ChatMessage).where(ChatMessage.conversation_id == conv_id)).all()
    for m in msgs:
        session.delete(m)
    session.delete(conv)
    session.commit()
    return {"ok": True}

@router.get("/conversations/{conv_id}/messages", response_model=List[ChatMessage])
def list_messages(conv_id: int, session: Session = Depends(get_session)):
    # ensure conversation exists
    conv = session.get(Conversation, conv_id)
    if not conv:
        raise HTTPException(404, "Conversation inconnue")
    res = session.exec(select(ChatMessage).where(ChatMessage.conversation_id == conv_id).order_by(ChatMessage.created_at)).all()
    return res

@router.post("/conversations/{conv_id}/messages", response_model=List[ChatMessage])
async def add_message(conv_id: int, body: MessageCreate, session: Session = Depends(get_session)):
    conv = session.get(Conversation, conv_id)
    if not conv:
        raise HTTPException(404, "Conversation inconnue")
    # store user/assistant message
    msg = ChatMessage(conversation_id=conv_id, role=body.role, content=body.content)
    session.add(msg)
    session.commit()
    session.refresh(msg)

    created: List[ChatMessage] = [msg]

    # optionally call LLM and store assistant reply
    if body.reply_with_llm and body.role == "user":
        system_prompt = (
            "Tu es l’assistant d’analyse de CyberSentinel. "
            "Tu peux répondre de manière conversationnelle aux salutations et questions générales. "
            "Ta mission principale reste l’explication des alertes, incidents et métriques de sécurité. "
            "Tu ne dois jamais proposer ni exécuter d’actions automatiques. "
            "Sois poli, clair et concis."
        )
        # build history
        history = session.exec(select(ChatMessage).where(ChatMessage.conversation_id == conv_id).order_by(ChatMessage.created_at)).all()
        messages_ollama = [{"role": "system", "content": system_prompt}]
        for h in history:
            messages_ollama.append({"role": h.role, "content": h.content})
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                resp = await client.post(
                    f"{OLLAMA_URL}/api/chat",
                    json={"model": MODEL, "messages": messages_ollama, "stream": False},
                )
                if resp.status_code != 200:
                    raise HTTPException(500, "Ollama indisponible")
                data = resp.json()
                content = data.get("message", {}).get("content", "")
            except Exception as e:
                raise HTTPException(500, f"Erreur LLM : {e}")
        reply = ChatMessage(conversation_id=conv_id, role="assistant", content=content)
        session.add(reply)
        session.commit()
        session.refresh(reply)
        created.append(reply)

    return created


@router.get("/conversations/{conv_id}/stream")
async def stream_reply(conv_id: int, voice_mode: bool = False, session: Session = Depends(get_session)):
    """
    SSE: génère une réponse assistant en streaming à partir de l’historique de la conversation.
    À la fin, stocke le message assistant complet.
    """
    conv = session.get(Conversation, conv_id)
    if not conv:
        raise HTTPException(404, "Conversation inconnue")

    if voice_mode:
        system_prompt = (
            "Tu es l'assistant vocal de CyberSentinel. "
            "Réponds en 1 à 2 phrases courtes, en français, de façon naturelle et conversationnelle. "
            "Pas de listes, pas de markdown, pas de code."
        )
        ollama_opts = {"num_predict": 100, "num_thread": 8, "temperature": 0.7}
    else:
        system_prompt = (
            "Tu es l'assistant d'analyse de CyberSentinel. "
            "Tu peux répondre de manière conversationnelle aux salutations et questions générales. "
            "Ta mission principale reste l'explication des alertes, incidents et métriques de sécurité. "
            "Tu ne dois jamais proposer ni exécuter d'actions automatiques. "
            "Sois poli, clair et concis."
        )
        ollama_opts = {"num_thread": 8}
    history = session.exec(
        select(ChatMessage).where(ChatMessage.conversation_id == conv_id).order_by(ChatMessage.created_at)
    ).all()
    messages_ollama = [{"role": "system", "content": system_prompt}]
    for h in history:
        messages_ollama.append({"role": h.role, "content": h.content})

    async def event_generator():
        buf = []
        async with httpx.AsyncClient(timeout=None) as client:
            try:
                async with client.stream(
                    "POST",
                    f"{OLLAMA_URL}/api/chat",
                    json={"model": MODEL, "messages": messages_ollama, "stream": True, "options": ollama_opts},
                ) as resp:
                    if resp.status_code != 200:
                        yield "event: error\ndata: Ollama indisponible\n\n"
                        return
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                        except Exception:
                            continue
                        msg = data.get("message", {})
                        token = msg.get("content", "")
                        if token:
                            buf.append(token)
                            yield f"data: {token}\n\n"
                        if data.get("done"):
                            full = "".join(buf)
                            # store assistant message
                            reply = ChatMessage(conversation_id=conv_id, role="assistant", content=full)
                            session.add(reply)
                            session.commit()
                            yield "event: done\ndata: end\n\n"
                            return
            except Exception as e:
                yield f"event: error\ndata: {str(e)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
