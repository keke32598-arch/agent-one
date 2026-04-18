# tests/test_graph.py
from src.agent.graph import build_agent_graph

def test_graph_compilation():
    app = build_agent_graph()
    # 只要 graph 能成功 compile 并返回对象，就说明节点和路由的拼装语法没有问题
    assert app is not None