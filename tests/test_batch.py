# tests/test_batch.py
from src.agent.state import AgentState
from src.agent.batch import process_batch

def test_process_batch():
    # 模拟进入节点前的状态
    state: AgentState = {
        "task_id": "1", 
        "file_type": "excel", 
        "raw_content": [{"text": "屏幕碎了，要求退换货"}], 
        "current_node": "", 
        "batch_results": [], 
        "analysis_result": {}, 
        "errors": []
    }
    
    result = process_batch(state)
    
    # 验证输出状态
    assert result["current_node"] == "batch_processing_subgraph"
    assert len(result["batch_results"]) == 1
    assert result["batch_results"][0]["category"] == "投诉"