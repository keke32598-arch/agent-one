# src/agent/analysis.py
import os
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from src.agent.state import AgentState

load_dotenv()

# 初始化通义千问模型 (单案深度分析场景，需要极强的逻辑推理，推荐 qwen-max 或 qwen-plus)
llm = ChatOpenAI(
    api_key=os.getenv("DASHSCOPE_API_KEY", "dummy_key"),
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    model="qwen-max", # 如果你有额度，这里可以换成 qwen-max
    temperature=0.3    # 稍微提高一点温度，让解决方案的生成更具创造性
)

# 定义单案分析的强结构化输出 Schema
class AnalysisResultSchema(BaseModel):
    fact: str = Field(description="客观提取案卷中的 5W1H 核心事实，必须剥离客户的情绪化表达，使用客观第三人称陈述。")
    pain_point: str = Field(description="痛点诊断，请穿透表面现象，分析出造成该客诉背后的深层业务漏洞或系统架构瓶颈。")
    solution: str = Field(description="分点论述的标准化企业解决方案（至少包含2-3个具体落地步骤）。")

def deep_analysis(state: AgentState) -> dict:
    """
    真实调用大模型的深度分析节点：阅读长文本，使用思维链提取事实、诊断痛点并出具方案。
    """
    raw_text = state.get("raw_content", "")
    
    # 构造更严密的 System Prompt
    prompt = ChatPromptTemplate.from_messages([
        ("system", "你是一位资深的业务架构师与客服案卷分析专家。你需要仔细阅读长篇客户反馈案卷，按要求提取客观事实、诊断深层痛点，并给出符合企业公文规范的落地方案。请务必以 JSON 格式输出结果。并且 JSON 的键（Key）必须严格保持为 'fact', 'pain_point', 'solution'，绝对不能把 Key 翻译成中文！"),
        ("user", "案卷原文：\n{text}")
    ])
    
    # 绑定结构化输出
    structured_llm = llm.with_structured_output(AnalysisResultSchema)
    chain = prompt | structured_llm
    
    try:
        # 如果 raw_text 是列表（因为我们之前 mock 时传的是字典列表），我们把它转成纯文本
        if isinstance(raw_text, list):
            text_to_analyze = "\n".join([item.get("text", "") for item in raw_text])
        else:
            text_to_analyze = str(raw_text)
            
      
        # 真实调用！
        res = chain.invoke({"text": text_to_analyze})
        
        result = {
            "事实": res.fact,
            "痛点诊断": res.pain_point,
            "解决方案": res.solution
        }
    except Exception as e:
        # 容错处理
        result = {
            "事实": "大模型解析异常",
            "痛点诊断": "N/A",
            "解决方案": f"API调用详情: {str(e)}"
        }
        
    return {
        "current_node": "deep_analysis_subgraph", 
        "analysis_result": result
    }