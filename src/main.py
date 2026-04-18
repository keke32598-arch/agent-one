# src/main.py
from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
import uuid

app = FastAPI(title="Customer Service Agent API")

class SubmitRequest(BaseModel):
    file_type: str

@app.post("/api/v1/agent/submit", status_code=202)
async def submit_task(request: SubmitRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    # 这里目前只是一个占位符，后续我们会把 LangGraph 的执行逻辑挂载到 background_tasks 中
    return {"task_id": task_id, "status": "processing"}