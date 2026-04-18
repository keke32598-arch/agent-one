// src/static/app.js

document.getElementById('upload-zone').addEventListener('click', () => {
    // 模拟文件选择：为了简化前端流程，我们先用弹窗让用户选择要测试的模式
    const fileType = prompt("请输入要测试的模式 (输入 'excel' 或 'pdf'):", "excel");
    if (!fileType || (fileType !== 'excel' && fileType !== 'pdf')) return;
    
    submitTask(fileType);
});

async function submitTask(fileType) {
    const statusZone = document.getElementById('status-zone');
    const resultZone = document.getElementById('result-zone');
    
    // UI 状态重置：显示加载区，清空结果区
    statusZone.classList.remove('hidden');
    statusZone.querySelector('span').innerText = "正在提交任务...";
    resultZone.innerHTML = "";

    try {
        // 调用我们的 Phase 3 写好的提交接口
        const response = await fetch('/api/v1/agent/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_type: fileType })
        });
        
        if (!response.ok) throw new Error("网络响应错误");
        
        const data = await response.json();
        // 拿到 task_id 后，开始轮询
        pollStatus(data.task_id);
    } catch (err) {
        statusZone.classList.replace('bg-blue-50', 'bg-red-50');
        statusZone.classList.replace('text-blue-700', 'text-red-700');
        statusZone.querySelector('span').innerText = "提交失败: " + err.message;
    }
}

async function pollStatus(taskId) {
    const statusZone = document.getElementById('status-zone');
    
    // 设置定时器，每 1 秒查询一次状态
    const interval = setInterval(async () => {
        try {
            const res = await fetch(`/api/v1/agent/status/${taskId}`);
            if (res.status === 200) {
                const data = await res.json();
                
                if (data.status === 'completed') {
                    // 任务完成，清除定时器
                    clearInterval(interval);
                    statusZone.classList.add('hidden'); // 隐藏加载状态
                    renderResult(data.data); // 渲染结果
                } else {
                    // 更新进度提示
                    statusZone.querySelector('span').innerText = `正在处理中... (Task ID: ${taskId})`;
                }
            }
        } catch (err) {
            console.error("轮询失败", err);
            clearInterval(interval);
        }
    }, 1000);
}

// 临时渲染函数：把后端返回的 JSON 数据直接打印在页面上
function renderResult(data) {
    const resultZone = document.getElementById('result-zone');
    resultZone.innerHTML = `<pre class="bg-slate-100 p-4 rounded-lg overflow-auto text-sm text-slate-700 border border-slate-200 shadow-inner">${JSON.stringify(data, null, 2)}</pre>`;
}