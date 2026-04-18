# Enterprise Customer Feedback & Requirement Analysis Agent Design
**Date:** 2026-04-18
**Path:** `docs/superpowers/specs/2026-04-18-customer-service-agent-design.md`

## 1. Project Context & Goals
本项目的目标是构建一个全栈企业级 Agent，用于自动化处理和分类客户诉求与业务需求。系统采用“统一路由与子图嵌套”架构，支持两种核心业务场景：
1.  **批处理模式 (Batch Mode)**：解析 Excel 中的海量短文本工单，进行分类与简要建议生成。
2.  **深度分析模式 (Deep Analysis Mode)**：解析 Word/PDF 长篇案卷，提取核心事实，诊断业务痛点，并生成结构化的专属解决方案。

## 2. System Architecture
系统分为三层，采用前后端分离加后台图编排的架构：
* **前端层 (Frontend)**：沉浸式混合工作台。支持拖拽上传文件，通过异步轮询获取进度。结果就绪后，渲染可编辑的表格（针对 Excel）或双栏报告面板（针对 Word/PDF），并支持一键导出结果文件。
* **后端层 (Backend - FastAPI)**：单一统一网关网关。负责接收文件流、进行预处理（文档结构解析为文本/JSON），并维护后台任务队列的状态。
* **智能中枢层 (Agent - LangGraph)**：系统的核心大脑，采用包含一个总控路由和两个独立执行子图的架构。

## 3. LangGraph Workflow & State
### 3.1 核心状态字典 (AgentState)
全局图流转状态使用严格类型的 `TypedDict` 进行约束：
* `task_id` (str): 任务追踪标识。
* `file_type` (Literal["excel", "pdf", "word"]): 用于 Router 的条件判定。
* `raw_content` (Any): 解析后的初始数据（List[Dict] 或 str）。
* `current_node` (str): 追踪执行进度，供前端展示。
* `batch_results` (List[Dict]): 批处理子图的聚合结果（包含原文、分类、建议）。
* `analysis_result` (Dict): 深度分析子图的输出结果（摘要、痛点、解决方案嵌套字典）。
* `errors` (List[str]): 异常与重试日志。

### 3.2 节点编排设计
1.  **Router Node (总控路由)**：基于 `file_type` 判断，将工作流引向对应的子图。
2.  **Batch Processing Subgraph (批处理子图)**：
    * 采用 Map-Reduce 并发/循环架构。
    * 通过 Few-Shot 提示词和强制 JSON Schema，规范大模型对每一条记录输出结构化的分类与建议。
3.  **Deep Analysis Subgraph (深度分析子图)**：
    * 采用 Sequential 架构。
    * **Fact Extractor**: 客观提取 5W1H 事实。
    * **Pain Point Diagnoser**: 采用 Chain of Thought (思维链) 分析深层矛盾。
    * **Solution Generator**: 基于企业规范模板生成完整对策。

## 4. API Specification
采用异步任务机制，避免长文档处理导致 HTTP 超时：
* **任务提交接口**：`POST /api/v1/agent/submit` (接收文件，返回 `task_id`)
* **状态查询接口**：`GET /api/v1/agent/status/{task_id}` (返回 `current_node` 进度及最终的 `batch_results` 或 `analysis_result`)

## 5. Error Handling & Edge Cases
* **LLM JSON 解析失败**：引入防御性的 `retry_node`。若模型未按 Schema 输出结构化数据，节点将捕获异常并附带报错信息让 LLM 重试（最大重试次数 2 次）。
* **Token 超限管理**：长文本解析阶段加入长度校验，若文本超出当前模型上下文限制，提前阻断并返回清晰的报错提示，或触发自动文本摘要预处理。