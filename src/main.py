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
    
    # 修复点：根据传入的文件类型，模拟不同的文件解析结果
    if file_type == "excel":
        # 模拟解析 Excel 得到的多行短文本
        mock_content = [
            {"text": "你们这新APP怎么一打开就闪退？赶紧修复！"},
            {"text": "今天客服小李态度特别好，非常有耐心，提出表扬。"},
            {"text": "请问年费会员怎么取消自动续费？"}
        ]
    else:
        # 模拟解析 PDF/Word 拿到的长篇案卷字符串
        mock_content = "大客户投诉案卷：关于双十一大促期间系统崩溃的严重反馈。客户表示昨天晚上熬夜抢购，结果一到零点点击付款，系统就一直转圈圈，最后提示订单失效。客户情绪非常激动，认为平台架构存在严重高并发瓶颈，严重损害了消费者权益，并威胁要拨打12315进行投诉。要求平台必须立刻给出详细的技术故障说明和补偿方案。"

    initial_state: AgentState = {
        "task_id": task_id,
        "file_type": file_type, # type: ignore
        "raw_content": mock_content, # 传入动态匹配的数据
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