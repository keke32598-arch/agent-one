# 覆盖 src/main.py 的全部内容
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.staticfiles import StaticFiles  # 新增
from fastapi.responses import FileResponse    # 新增
import os
from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
import uuid
from typing import Dict, Any

from src.agent.state import AgentState
from src.agent.graph import build_agent_graph

app = FastAPI(title="Customer Service Agent API")

# 确保静态目录存在
os.makedirs("src/static", exist_ok=True)

# 挂载静态资源路径
app.mount("/static", StaticFiles(directory="src/static"), name="static")

# 根路径路由：直接返回 index.html
@app.get("/")
async def serve_index():
    return FileResponse("src/static/index.html")
    
# 内存数据库，用于存储任务进度和结果 (MVP版本，生产环境可用 Redis 替代)
TASK_STORE: Dict[str, Dict[str, Any]] = {}

# 初始化我们阶段 2 写好的 LangGraph 实例
agent_app = build_agent_graph()

class SubmitRequest(BaseModel):
    file_type: str

def run_agent_task(task_id: str, file_type: str):
    """在后台实际运行 LangGraph 任务，并更新结果到 TASK_STORE"""
    initial_state: AgentState = {
        "task_id": task_id,
        "file_type": file_type, # type: ignore
        "raw_content": [{"text": "模拟的真实用户传入数据"}], # 暂时传入Mock数据打通流程
        "current_node": "start",
        "batch_results": [],
        "analysis_result": {},
        "errors": []
    }
    
    # 调用大模型/图开始流转
    final_state = agent_app.invoke(initial_state)
    
    # 运行完毕，更新存储状态
    TASK_STORE[task_id] = {
        "status": "completed",
        "result": final_state
    }

@app.post("/api/v1/agent/submit", status_code=202)
async def submit_task(request: SubmitRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    
    # 1. 初始化任务状态
    TASK_STORE[task_id] = {"status": "processing", "result": None}
    
    # 2. 将图的执行过程挂载到 FastAPI 的后台任务中，不阻塞 HTTP 响应
    background_tasks.add_task(run_agent_task, task_id, request.file_type)
    
    # 3. 立即向前端返回任务 ID
    return {"task_id": task_id, "status": "processing"}
    # src/main.py 修改点 2：在文件最末尾追加以下接口代码
@app.get("/api/v1/agent/status/{task_id}")
async def get_task_status(task_id: str):
    """前端轮询接口，用于获取图的执行进度和最终结果"""
    if task_id not in TASK_STORE:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task_data = TASK_STORE[task_id]
    return {
        "task_id": task_id,
        "status": task_data["status"],
        "data": task_data["result"]
    }