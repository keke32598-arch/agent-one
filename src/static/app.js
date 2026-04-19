// src/static/app.js (替换顶部的逻辑)

// 1. 点击拖拽区，触发隐藏的文件选择器
document.getElementById('upload-zone').addEventListener('click', () => {
    document.getElementById('file-input').click();
});

// 2. 监听文件选择完成事件
document.getElementById('file-input').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // 获取到物理文件后，直接提交
    submitTask(file);
    
    // 清空 input 的值，这样下次即使选同一个文件也能触发 change 事件
    event.target.value = ''; 
});

// 3. 提交真实文件流到后端
async function submitTask(file) {
    const statusZone = document.getElementById('status-zone');
    const resultZone = document.getElementById('result-zone');
    
    // UI 状态更新
    statusZone.classList.remove('hidden');
    // 显示真实的文件名
    statusZone.querySelector('span').innerText = `正在上传并分析: ${file.name} ...`;
    resultZone.innerHTML = "";

    // 核心改变：使用 FormData 封装二进制文件
    const formData = new FormData();
    formData.append("file", file);

    try {
        // 注意：使用 FormData 时，千万不要手动设置 'Content-Type' header，浏览器会自动设置正确的 boundary！
        const response = await fetch('/api/v1/agent/submit', {
            method: 'POST',
            body: formData 
        });
        
        if (!response.ok) throw new Error(`HTTP 错误! 状态码: ${response.status}`);
        
        const data = await response.json();
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

// 渲染函数
function renderResult(data) {
    const resultZone = document.getElementById('result-zone');
    resultZone.innerHTML = ""; // 渲染前先清空旧内容
    
    // 场景 1：如果进入的是批处理子图 (Excel模式)
    if (data.current_node === 'batch_processing_subgraph') {
        let tableHTML = `
            <div class="transition-all duration-500 ease-in-out opacity-100 transform translate-y-0">
                <h2 class="text-2xl font-bold text-slate-800 mb-6 flex items-center">
                    <span class="text-3xl mr-2">📊</span> 批处理分类结果
                </h2>
                <div class="overflow-hidden bg-white rounded-xl shadow-sm border border-slate-200">
                    <table class="min-w-full divide-y divide-slate-200">
                        <thead class="bg-slate-50">
                            <tr>
                                <th scope="col" class="px-6 py-4 text-left text-sm font-bold text-slate-600 tracking-wider">原文本</th>
                                <th scope="col" class="px-6 py-4 text-left text-sm font-bold text-slate-600 tracking-wider">分类标签</th>
                                <th scope="col" class="px-6 py-4 text-left text-sm font-bold text-slate-600 tracking-wider">AI 建议</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-200 bg-white">
        `;
        
        // 遍历生成表格行
        data.batch_results.forEach(row => {
            tableHTML += `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="px-6 py-4 text-sm text-slate-700 font-medium">${row.original}</td>
                    <td class="px-6 py-4 text-sm whitespace-nowrap">
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            ${row.category}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-slate-500">${row.suggestion}</td>
                </tr>
            `;
        });
        tableHTML += `</tbody></table></div></div>`;
        resultZone.innerHTML = tableHTML;
        
    // 场景 2：如果进入的是深度分析子图 (PDF/Word模式)
    } else if (data.current_node === 'deep_analysis_subgraph') {
        const analysis = data.analysis_result;
        resultZone.innerHTML = `
            <div class="transition-all duration-500 ease-in-out opacity-100 transform translate-y-0">
                <h2 class="text-2xl font-bold text-slate-800 mb-6 flex items-center border-b border-slate-200 pb-4">
                    <span class="text-3xl mr-2">📑</span> 深度研讨诊断报告
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div class="bg-rose-50 rounded-2xl p-6 border border-rose-100 shadow-sm hover:shadow-md transition-shadow">
                        <div class="flex items-center mb-4">
                            <span class="text-2xl mr-2">🚨</span>
                            <h3 class="text-lg font-extrabold text-rose-900">痛点诊断</h3>
                        </div>
                        <p class="text-rose-800 leading-relaxed font-medium">${analysis['痛点诊断']}</p>
                    </div>
                    
                    <div class="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 shadow-sm hover:shadow-md transition-shadow">
                        <div class="flex items-center mb-4">
                            <span class="text-2xl mr-2">💡</span>
                            <h3 class="text-lg font-extrabold text-emerald-900">解决方案</h3>
                        </div>
                        <p class="text-emerald-800 leading-relaxed font-medium whitespace-pre-line">${analysis['解决方案']}</p>
                    </div>
                    
                    <div class="md:col-span-2 bg-slate-50 rounded-2xl p-6 border border-slate-200 shadow-sm mt-2">
                        <div class="flex items-center mb-3">
                            <span class="text-xl mr-2">📌</span>
                            <h3 class="text-md font-bold text-slate-800">提取事实原文</h3>
                        </div>
                        <p class="text-slate-600 italic border-l-4 border-slate-300 pl-4 py-1">${analysis['事实']}</p>
                    </div>
                </div>
            </div>
        `;
    }
}