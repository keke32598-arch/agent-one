# src/agent/batch.py
import os
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from src.agent.state import AgentState

# 加载 .env 文件中的 DASHSCOPE_API_KEY
load_dotenv()

# 初始化通义千问模型 (使用 OpenAI 兼容接口协议)
llm = ChatOpenAI(
    api_key=os.getenv("DASHSCOPE_API_KEY", "dummy_key"),
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    model="qwen-plus", # 批处理推荐使用 qwen-plus，性价比与分类能力平衡得很好
    temperature=0.1    # 降低温度，保证分类结果的稳定性
)

# 定义强制结构化输出的 Schema (这是防范大模型乱说话的核心约束)
class BatchResultSchema(BaseModel):
    category: str = Field(description="诉求分类，必须且只能从以下标签中选择一个：['投诉', '咨询', '需求', '表扬', '其他']")
    suggestion: str = Field(description="针对该诉求的一句话简短处理建议，不超过20个字")

def process_batch(state: AgentState) -> dict:
    """
    真实调用大模型的批处理节点：遍历短文本，强制输出结构化分类结果。
    """
    results = []
    raw_data = state.get("raw_content", [])
    
    # 构造系统 Prompt 模板
    prompt = ChatPromptTemplate.from_messages([
        ("system", "你是一位专业的企业客服数据分析专家。请根据用户提供的客诉短文本，进行准确分类并给出处理建议。请以 JSON 格式返回。并且 JSON 的键（Key）必须严格保持为 'fact', 'pain_point', 'solution'，绝对不能把 Key 翻译成中文！"),
        ("user", "原始文本：{text}")
    ])
    
    # 将大模型与 Schema 绑定，生成一个强制输出结构化数据的对象
    structured_llm = llm.with_structured_output(BatchResultSchema)
    
    # 组装 Chain
    chain = prompt | structured_llm
    
    if isinstance(raw_data, list):
        for item in raw_data:
            text = item.get("text", "")
            if not text:
                continue
            
            try:
                # 真实调用通义千问！
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