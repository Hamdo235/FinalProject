import pytest
from fastapi import HTTPException
from sqlmodel import Session
from app.db.session import engine
from app.routers.llm_chat import chat, ChatRequest

@pytest.mark.anyio
async def test_llm_chat_non_stream():
    req = ChatRequest(messages=[{"role": "user", "content": "Bonjour"}], context="global")
    with Session(engine) as db:
        try:
            res = await chat(req=req, stream=False, db=db)
            assert isinstance(res, dict)
            assert isinstance(res.get("response", ""), str)
        except HTTPException as exc:
            assert exc.status_code in (502, 504)


@pytest.mark.anyio
async def test_llm_chat_stream_handshake():
    req = ChatRequest(messages=[{"role": "user", "content": "Test stream"}], context="global")
    with Session(engine) as db:
        response = await chat(req=req, stream=True, db=db)
        chunk = await anext(response.body_iterator)
    assert isinstance(chunk, str)
    assert ("event: error" in chunk) or ("data:" in chunk)
