# tests/test_state.py
from typing import get_type_hints
from src.agent.state import AgentState

def test_agent_state_fields():
    hints = get_type_hints(AgentState)
    assert "task_id" in hints
    assert hints["task_id"] == str
    assert "file_type" in hints
    assert "current_node" in hints
    assert "batch_results" in hints
    assert "analysis_result" in hints
    assert "errors" in hints