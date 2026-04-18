# src/agent/router.py
from src.agent.state import AgentState

def route_task(state: AgentState) -> str:
    """
    根据文件类型将任务路由到对应的处理子图。
    """
    if state["file_type"] == "excel":
        return "batch_processing_subgraph"
    return "deep_analysis_subgraph"