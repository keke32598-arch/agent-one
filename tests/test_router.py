# tests/test_router.py
from src.agent.state import AgentState
from src.agent.router import route_task

def test_route_task_excel():
    state: AgentState = {
        "task_id": "1", 
        "file_type": "excel", 
        "raw_content": "", 
        "current_node": "", 
        "batch_results": [], 
        "analysis_result": {}, 
        "errors": []
    }
    assert route_task(state) == "batch_processing_subgraph"

def test_route_task_pdf():
    state: AgentState = {
        "task_id": "2", 
        "file_type": "pdf", 
        "raw_content": "", 
        "current_node": "", 
        "batch_results": [], 
        "analysis_result": {}, 
        "errors": []
    }
    assert route_task(state) == "deep_analysis_subgraph"