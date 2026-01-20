from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_llm_chat_non_stream():
    r = client.post("/llm/chat", json={
        "messages": [{"role": "user", "content": "Bonjour"}],
        "context": "global"
    })
    assert r.status_code in (200, 502, 504)  # dépend de la dispo d'Ollama
    if r.status_code == 200:
        data = r.json()
        assert "response" in data


def test_llm_chat_stream_handshake():
    # Vérifie que l'endpoint stream répond et ne renvoie pas d'erreur immédiate
    with client.stream("POST", "/llm/chat?stream=true", json={
        "messages": [{"role": "user", "content": "Test stream"}],
        "context": "global"
    }) as resp:
        assert resp.status_code in (200, 502)
