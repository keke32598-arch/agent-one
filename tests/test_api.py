# tests/test_api.py
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_submit_task():
    response = client.post("/api/v1/agent/submit", json={"file_type": "excel"})
    assert response.status_code == 202
    assert "task_id" in response.json()
    assert response.json()["status"] == "processing"
    # 追加到 tests/test_api.py 末尾
def test_background_worker_updates_store():
    # 这是一个集成测试，验证 FastAPI 的后台任务能否成功拉起 LangGraph 并写入存储
    response = client.post("/api/v1/agent/submit", json={"file_type": "excel"})
    assert response.status_code == 202
    task_id = response.json()["task_id"]
    
    # 动态导入 TASK_STORE 进行验证
    from src.main import TASK_STORE
    
    # 因为 TestClient 会同步瞬间执行完 BackgroundTasks，所以状态已经是 completed
    assert TASK_STORE[task_id]["status"] == "completed"
    
    # 进一步验证图的结果是不是成功存进来了
    assert TASK_STORE[task_id]["result"] is not None
    assert TASK_STORE[task_id]["result"]["current_node"] == "batch_processing_subgraph"
    # 追加到 tests/test_api.py 末尾
def test_get_task_status():
    # 先提交一个任务
    submit_res = client.post("/api/v1/agent/submit", json={"file_type": "pdf"})
    task_id = submit_res.json()["task_id"]
    
    # 查询状态
    status_res = client.get(f"/api/v1/agent/status/{task_id}")
    assert status_res.status_code == 200
    assert "status" in status_res.json()
    assert "data" in status_res.json()
    # 验证单案分析的结果是否通过接口成功返回
    assert status_res.json()["data"]["current_node"] == "deep_analysis_subgraph"
    
def test_get_task_status_not_found():
    # 查询一个不存在的任务
    status_res = client.get("/api/v1/agent/status/invalid-id-12345")
    assert status_res.status_code == 404
    # 追加到 tests/test_api.py 末尾
def test_frontend_served():
    # 测试 FastAPI 是否正确挂载并返回了静态主页
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]