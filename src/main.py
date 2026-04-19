# src/main.py
from fastapi import FastAPI, BackgroundTasks, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uuid
from typing import Dict, Any
import os
import shutil

from src.agent.state import AgentState
from src.agent.graph import build_agent_graph
from src.utils.parser import parse_document  # 引入刚才写的统一解析器

app = FastAPI(title="Customer Service Agent API")

TASK_STORE: Dict[str, Dict[str, Any]] = {}
agent_app = build_agent_graph()

# 确保静态目录存在
os.makedirs("src/static", exist_ok=True)
app.mount("/static", StaticFiles(directory="src/static"), name="static")

# 确保临时上传目录存在 (用于暂存物理文件)
UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
async def serve_index():
    return FileResponse("src/static/index.html")

def run_agent_task(task_id: str, file_path: str):
    """在后台实际运行 LangGraph 任务，包含真实文件解析和自动清理"""
    try:
        # 1. 核心大更新：调用 parser.py 解析真实的物理文件！
        parsed_data = parse_document(file_path)
        
        # 2. 组装初始状态，把解析出来的真实数据喂进去
        initial_state: AgentState = {
            "task_id": task_id,
            "file_type": parsed_data["file_type"], # type: ignore
            "raw_content": parsed_data["raw_content"],
            "current_node": "start",
            "batch_results": [],
            "analysis_result": {},
            "errors": []
        }
        
        # 3. 调用大模型/图开始流转
        final_state = agent_app.invoke(initial_state)
        
        # 4. 运行完毕，更新存储状态
        TASK_STORE[task_id] = {
            "status": "completed",
            "result": final_state
        }
    except Exception as e:
        # 捕获解析报错或大模型崩溃，方便排查
        TASK_STORE[task_id] = {
            "status": "failed",
            "error": str(e)
        }
    finally:
        # 5. 极客修养：无论成功失败，处理完必须删掉临时物理文件，防止磁盘塞满
        if os.path.exists(file_path):
            os.remove(file_path)

# 注意这里：我们去掉了 JSON BaseModel，改用 UploadFile 接收表单文件流
@app.post("/api/v1/agent/submit", status_code=202)
async def submit_task(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    task_id = str(uuid.uuid4())
    
    # 1. 将前端传来的文件流保存到本地临时目录
    file_path = os.path.join(UPLOAD_DIR, f"{task_id}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # 2. 初始化任务状态
    TASK_STORE[task_id] = {"status": "processing", "result": None}
    
    # 3. 将后台任务挂载到队列，这次传入的是真实的物理路径
    background_tasks.add_task(run_agent_task, task_id, file_path)
    
    return {"task_id": task_id, "status": "processing"}

@app.get("/api/v1/agent/status/{task_id}")
async def get_task_status(task_id: str):
    if task_id not in TASK_STORE:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task_data = TASK_STORE[task_id]
    
    # 增加对失败状态的友好抛出
    if task_data["status"] == "failed":
        raise HTTPException(status_code=500, detail=task_data.get("error", "文件解析或大模型处理失败"))
        
    return {
        "task_id": task_id,
        "status": task_data["status"],
        "data": task_data.get("result")
    }