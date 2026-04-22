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
    fact: str = Field(
        description="【客观事实】用一句大白话总结到底发生了什么事。剥离情绪，直接陈述事实，比如'客户买了三个月的主板烧了，客服两天没回消息'。"
    )
    pain_point: str = Field(
        description="【痛点诊断】直击灵魂的剖析。不要扯高大上的系统漏洞！说白了，客户到底在气什么？是觉得被糊弄了？还是觉得咱们效率太慢？咱们的服务在哪一步让人恶心了？（允许使用换行符分点）"
    )
    solution: str = Field(
        description="【解决方案】给出能立刻执行的'灭火方案'。拒绝官方套话！直接说第一步怎么安抚情绪（比如直接打电话道歉），第二步怎么实际补偿或解决。要接地气，可落地执行。（强烈建议使用换行符排版，保持节奏清晰）"
    )

def deep_analysis(state: AgentState) -> dict:
    """
    真实调用大模型的深度分析节点：阅读长文本，使用思维链提取事实、诊断痛点并出具方案。
    """
    raw_text = state.get("raw_content", "")
    
    # 构造更严密的 System Prompt
    prompt = ChatPromptTemplate.from_messages([
                ("system", """你不是冷冰冰的系统架构师，而是一位“深谙人性、在服务行业摸爬滚打多年的金牌店长”。
        你的任务是处理棘手的客户投诉案卷。你说话直击要害、一针见血，绝不护短，充满人情味。

        【你的行为准则】
        1. 拒绝八股文和公关腔：严禁使用“优化底层链路”、“协同相关部门”、“加强培训”这种废话。
        2. 直击要害：一眼看穿客户愤怒背后的真实诉求（要面子？要退钱？要个说法？）。
        3. 接地气：给出的解决方案必须是客服小妹立刻就能照着做的具体动作。

        【严格的格式纪律】
        请务必以 JSON 格式输出结果。并且 JSON 的键（Key）必须严格保持为 'fact', 'pain_point', 'solution'，绝对不能把 Key 翻译成中文！"""),
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