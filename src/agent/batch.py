# src/agent/batch.py
import os
from dotenv import load_dotenv
from typing import Literal
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from src.agent.state import AgentState

# 加载 .env 文件中的 DASHSCOPE_API_KEY
load_dotenv()

# 初始化零温大模型，消除随机性
llm = ChatOpenAI(
    api_key=os.getenv("DASHSCOPE_API_KEY", "dummy_key"),
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    model="qwen-plus", 
    temperature=0.0    
)

# ==========================================
# Task 1: 强化 Pydantic 底层字段约束
# ==========================================
AllowedCategories = Literal["产品问题", "物流问题", "服务态度", "其他"]

class BatchResultSchema(BaseModel):
    category: AllowedCategories = Field(
        description="客诉分类标签，必须严格从列表中选择其一"
    )
    # 【核心改动】将宽泛的说明改为极其严厉的指令格式要求
    suggestion: str = Field(
        description="极简系统操作指令。必须是15字以内的动宾短语（如'全额退款'、'核实后补发'），绝不允许包含'建议'、'可以'等口语废话。"
    )

def process_batch(state: AgentState) -> dict:
    """
    真实调用大模型的批处理节点：遍历短文本，强制输出结构化分类结果。
    """
    results = []
    raw_data = state.get("raw_content", [])
    
    # ==========================================
    # Task 2: 注入“处理建议规范”与正反例 (Few-shot)
    # ==========================================
    system_prompt = """你是一个严谨的企业级客诉分析架构师。
你的任务是对客户反馈进行精准分类，并提出处理建议。

【核心业务分类标准】
请严格按照以下4个标准进行对号入座，绝不能超出此范围：
1. "产品问题"：涉及公司提供的商品或软件本身的问题。产品材质差、做工瑕疵，以及 APP闪退、软件卡顿、充值报错等功能性故障。
2. "物流问题"：涉及快递损坏、发货慢、丢件、虚假签收、快递员态度恶劣等。
3. "服务态度"：涉及我们公司内部客服不理人、回复慢、态度敷衍或恶劣等。
4. "其他"：无法归入以上三类的模糊表达、单纯的情绪发泄、表扬好评或不相关的闲聊。

【处理建议 (suggestion) 生成规范】
大模型默认的回答过于啰嗦。你生成的 suggestion 必须是“极简系统操作指令”，请严格遵守：
- 必须使用“动宾短语”结构。
- 绝对字数限制：总长度不得超过 15 个字。
- 禁用词汇：绝不允许出现“建议您”、“可以尝试”、“如果”、“的话”等口语化废话。
- 【错误示范 ❌】：建议先核实一下物流进度，如果真的丢件了就重发或者退款吧。
- 【正确示范 ✅】：核实物流，退款或重发
- 【错误示范 ❌】：可以尝试致电客户安抚一下情绪，然后申请补偿优惠券。
- 【正确示范 ✅】：致电安抚，补偿优惠券

【绝对纪律】
- 分类标签【必须且只能】使用上述4个中文词汇之一。
- 绝不允许输出英文标签。
- 绝不允许自行创造新的分类名称。"""

    # 构造 ChatPromptTemplate
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("user", "原始文本：{text}")
    ])
    
    # 将大模型与 Schema 绑定，生成强制输出结构化数据的对象
    structured_llm = llm.with_structured_output(BatchResultSchema)
    
    # 组装 Chain
    chain = prompt | structured_llm
    
    if isinstance(raw_data, list):
        for item in raw_data:
            text = item.get("text", "")
            if not text:
                continue
            
            try:
                # 真实调用通义千问
                res = chain.invoke({"text": text})
                results.append({
                    "original": text,
                    "category": res.category,
                    "suggestion": res.suggestion
                })
            except Exception as e:
                # 容错降级处理
                results.append({
                    "original": text,
                    "category": "解析失败",
                    "suggestion": f"API调用异常: {str(e)}"
                })
                
    return {
        "current_node": "batch_processing_subgraph", 
        "batch_results": results
    }