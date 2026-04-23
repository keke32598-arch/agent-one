# src/main.py
from fastapi import FastAPI, BackgroundTasks, HTTPException, UploadFile, File, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import uuid
from typing import Dict, Any, List
import os
import shutil
import sqlite3
import json
from datetime import datetime, timedelta
import jwt  # 引入 JWT

from src.agent.state import AgentState
from src.agent.graph import build_agent_graph
from src.utils.parser import parse_document
from pydantic import BaseModel
import pandas as pd
import io
from fastapi.responses import StreamingResponse

# --- JWT 鉴权全局配置 ---
SECRET_KEY = "lk-agent-super-secret-key-2026"  # 生产环境中应写入 .env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # Token 有效期 1 天
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def get_db():
    conn = sqlite3.connect("tasks.db", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

# --- 核心拦截器：解析请求头中的 JWT 令牌 ---
def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="无效或过期的数字令牌，请重新登录")

# 接收前端派单请求的数据结构
class WorkOrderCreate(BaseModel):
    parent_task_id: str
    assignee_dept: str
    instructions: str = "请尽快处理该客诉"

# --- 数据库 2.0：引入用户表与工单流转表 ---
def init_db():
    with get_db() as conn:
        # 1. 保留原有的 AI 分析任务表
        conn.execute('''
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                status TEXT,
                data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        # 2. 新增：用户账号表
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                password TEXT,
                role TEXT,
                department TEXT
            )
        ''')
        # 3. 新增：业务工单流转表
        conn.execute('''
            CREATE TABLE IF NOT EXISTS work_orders (
                id TEXT PRIMARY KEY,
                parent_task_id TEXT,
                assignee_dept TEXT,
                status TEXT,
                proof_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 4. 系统启动时，自动注入三个默认测试账号
        boss = conn.execute("SELECT * FROM users WHERE username='boss'").fetchone()
        if not boss:
            # 账号：boss / 密码：123456 (角色：店长)
            conn.execute("INSERT INTO users (username, password, role, department) VALUES ('boss', '123456', 'boss', 'management')")
            # 账号：staff1 / 密码：123456 (角色：员工，部门：财务部)
            conn.execute("INSERT INTO users (username, password, role, department) VALUES ('staff1', '123456', 'staff', '财务部')")
            # 账号：staff2 / 密码：123456 (角色：员工，部门：物流组)
            conn.execute("INSERT INTO users (username, password, role, department) VALUES ('staff2', '123456', 'staff', '物流组')")

init_db()  # 启动时自动建表与注入数据

app = FastAPI(title="LK-Agent Enterprise API")

# ... (下方保留你原有的 VERSION_LOGS, TASK_STORE 和其他所有接口) ...


# 定义更新日志数据与接口 
VERSION_LOGS = [
    
    {
        "date": "2026-04-23", 
        "version": "v2.0版本启动", 
        "content": "2.0版本马上启动，会包括老板端和员工端，实现企业级SaaS 系统"
    }, {
        "date": "2026-04-23", 
        "version": "v1.0完结！", 
        "content": "今天是个好日子，v1.0版本已经做完了，它基本实现了该有的功能，包括上传文档、分析文档、给出解决方案。"
    }, 
    {
        "date": "2026-04-22", 
        "version": "新增功能", 
        "content": "今天更新了个历史记录功能，就是那个档案馆，可以查看之前处理的文档报告"
    }, 
    {
        "date": "2026-04-19", 
        "version": "我又有想法了", 
        "content": "弄个用户界面，两种用户，老板和员工，老板接到AI给出的解决策略，一键发给相应的员工处理，员工处理完后上报老板"
    }, 
    {
        "date": "2026-04-19", 
        "version": "随便写点什么", 
        "content": "这是一个面向销售厂家的Agent，我的畅想是它可以调用pdd的API，抓取客户的诉求，然后丢给AI大模型，最后给出解决方案"
    }, 
    {
        "date": "2026-04-19", 
        "version": "项目上线", 
        "content": "支持 Excel/PDF 解析。"
    }, 
    {
        "date": "我是水字数", 
        "version": "我是水字数", 
        "content": "我是水字数"
    }, 
    {
        "date": "我是水字数", 
        "version": "我是水字数", 
        "content": "我是水字数"
    }, 
]

@app.get("/api/v1/changelog")
async def get_changelog():
    """下发系统更新日志"""
    return VERSION_LOGS

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
        with get_db() as conn:
            conn.execute("UPDATE tasks SET status=?, data=? WHERE id=?",
                 ("completed", json.dumps({"result": final_state}), task_id))
    except Exception as e:
        # 捕获解析报错或大模型崩溃，方便排查
        with get_db() as conn:
            conn.execute("UPDATE tasks SET status=?, data=? WHERE id=?",
                 ("failed", json.dumps({"error": str(e)}), task_id))
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
    with get_db() as conn:
        conn.execute("INSERT INTO tasks (id, status, data) VALUES (?, ?, ?)", 
                 (task_id, "running", json.dumps({})))
    
    # 3. 将后台任务挂载到队列，这次传入的是真实的物理路径
    background_tasks.add_task(run_agent_task, task_id, file_path)
    
    return {"task_id": task_id, "status": "processing"}

@app.get("/api/v1/agent/status/{task_id}")
async def get_task_status(task_id: str):
    with get_db() as conn:
        row = conn.execute("SELECT status, data FROM tasks WHERE id=?", (task_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        status = row["status"]
        data = json.loads(row["data"])
        
        if status == "failed":
            raise HTTPException(status_code=500, detail=data.get("error", "大模型处理失败"))
        return {"status": status, "result": data.get("result")}
# 修改 src/main.py 中的 get_history_tasks 接口
@app.get("/api/v1/tasks")
async def get_history_tasks():
    with get_db() as conn:
        # 1. SQL 增加拉取 data 字段，并且把上限提高到 50 条
        rows = conn.execute("SELECT id, status, created_at, data FROM tasks ORDER BY created_at DESC LIMIT 50").fetchall()
        
        results = []
        for row in rows:
            mode = "unknown"
            try:
                # 2. 从 JSON 字符串中动态嗅探它的工作模式
                data_dict = json.loads(row["data"])
                if "result" in data_dict and data_dict["result"]:
                    # 提取 current_node，它决定了是批处理还是深度研讨
                    mode = data_dict["result"].get("current_node", "unknown")
            except:
                pass
                
            results.append({
                "id": row["id"], 
                "status": row["status"], 
                "created_at": row["created_at"],
                "mode": mode  # 3. 将 mode 连同数据一起发给前端
            })
        return results


# src/main.py 到处接口
import pandas as pd
import io
from fastapi.responses import StreamingResponse

# 1. 【新增】：定义极其严格的数据接收模型
class ExportRequest(BaseModel):
    results: List[Dict[str, Any]]

# 2. 【修改】：让接口接收刚才定义的模型
@app.post("/api/v1/export/batch")
async def export_batch_results(req: ExportRequest):
    """将 AI 处理结果转换为 Excel 下载流"""
    try:
        # 注意这里从 results 变成了 req.results
        df = pd.DataFrame(req.results)
        
        column_mapping = {
            "original": "原始文本",
            "category": "分类标签",
            "suggestion": "AI 处理建议"
        }
        df = df.rename(columns=column_mapping)
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='AI分析结果')
            
        output.seek(0)
        
        headers = {
            'Content-Disposition': 'attachment; filename="LK_Analysis_Report.xlsx"'
        }
        return StreamingResponse(
            output, 
            headers=headers, 
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")



        # --- 鉴权中心：登录与颁发 Token ---
@app.post("/api/v1/auth/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    with get_db() as conn:
        # 1. 校验账号密码
        user = conn.execute("SELECT * FROM users WHERE username=? AND password=?", 
                            (form_data.username, form_data.password)).fetchone()
        if not user:
            raise HTTPException(status_code=400, detail="账号或密码错误！")
        
        # 2. 制作专属 JWT 令牌，将角色和部门烙印在 Token 里
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        expire = datetime.utcnow() + access_token_expires
        to_encode = {
            "sub": user["username"], 
            "role": user["role"], 
            "department": user["department"],
            "exp": expire
        }
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        
        # 3. 发放令牌给前端
        return {
            "access_token": encoded_jwt, 
            "token_type": "bearer", 
            "role": user["role"],
            "department": user["department"]
        }