# src/agent/graph.py
from langgraph.graph import StateGraph, END
from src.agent.state import AgentState
from src.agent.router import route_task
from src.agent.batch import process_batch
from src.agent.analysis import deep_analysis

def build_agent_graph():
    """
    组装并编译整个企业客服 Agent 的核心工作流
    """
    # 1. 初始化状态图
    workflow = StateGraph(AgentState)
    
    # 2. 注册图节点
    workflow.add_node("batch_processing_subgraph", process_batch)
    workflow.add_node("deep_analysis_subgraph", deep_analysis)
    
    # 3. 设置入口条件边 (也就是我们的“智能接待员”Router)
    workflow.set_conditional_entry_point(
        route_task,
        {
            "batch_processing_subgraph": "batch_processing_subgraph",
            "deep_analysis_subgraph": "deep_analysis_subgraph"
        }
    )
    
    # 4. 设置结束边 (处理完毕后流程结束)
    workflow.add_edge("batch_processing_subgraph", END)
    workflow.add_edge("deep_analysis_subgraph", END)
    
    # 5. 编译成可执行的 application
    return workflow.compile()