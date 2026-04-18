# src/agent/batch.py
from src.agent.state import AgentState

def process_batch(state: AgentState) -> dict:
    """
    模拟批处理节点：遍历原始数据并进行分类打标。
    未来这里将接入通义千问 (Qwen) 的 API 进行真实的批量预测。
    """
    results = []
    # 提取传入的原始数据 (应当是一个列表)
    raw_data = state.get("raw_content")
    
    if isinstance(raw_data, list):
        for item in raw_data:
            # 模拟大模型的结构化输出
            results.append({
                "original": item.get("text", ""), 
                "category": "投诉", 
                "suggestion": "建议转交售后技术团队评估换新"
            })
            
    # 返回需要更新到全局 State 中的字段
    return {
        "current_node": "batch_processing_subgraph", 
        "batch_results": results
    }