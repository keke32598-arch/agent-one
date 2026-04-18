# src/agent/state.py
from typing import TypedDict, Any, List, Dict, Literal

class AgentState(TypedDict):
    task_id: str
    file_type: Literal["excel", "pdf", "word"]
    raw_content: Any
    current_node: str
    batch_results: List[Dict]
    analysis_result: Dict
    errors: List[str]