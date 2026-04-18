# tests/test_analysis.py
from src.agent.state import AgentState
from src.agent.analysis import deep_analysis

def test_deep_analysis():
    # 模拟进入节点前的状态
    state: AgentState = {
        "task_id": "2", 
        "file_type": "pdf", 
        "raw_content": "大客户反馈系统在双十一期间出现多次崩溃，导致订单流失。", 
        "current_node": "", 
        "batch_results": [], 
        "analysis_result": {}, 
        "errors": []
    }
    
    result = deep_analysis(state)
    
    # 验证输出状态
    assert result["current_node"] == "deep_analysis_subgraph"
    assert "事实" in result["analysis_result"]
    assert "痛点诊断" in result["analysis_result"]
    assert "解决方案" in result["analysis_result"]
    assert result["analysis_result"]["事实"] == state["raw_content"]