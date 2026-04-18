# tests/test_api.py
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_submit_task():
    response = client.post("/api/v1/agent/submit", json={"file_type": "excel"})
    assert response.status_code == 202
    assert "task_id" in response.json()
    assert response.json()["status"] == "processing"