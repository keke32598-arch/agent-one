// 获取 DOM 元素
const btnBatch = document.getElementById('btn-batch');
const btnDeep = document.getElementById('btn-deep');
const uploadTitle = document.getElementById('upload-title');
const fileInput = document.getElementById('file-input');

// 简化样式切换：只使用新写的自定义类
const baseClass = "btn-cyber";
const activeClass = "btn-cyber btn-cyber-active";

// 点击【批处理模式】
btnBatch.addEventListener('click', () => {
    btnBatch.className = activeClass;
    btnDeep.className = baseClass;
    
    uploadTitle.innerText = "请上传 Excel 或 CSV 文件";
    fileInput.accept = ".xlsx,.xls,.csv";
});

// 点击【深度研讨模式】
btnDeep.addEventListener('click', () => {
    btnDeep.className = activeClass;
    btnBatch.className = baseClass;
    
    uploadTitle.innerText = "请上传 PDF 或 Word 文件";
    fileInput.accept = ".pdf,.doc,.docx";
});
// ... 下面保留你原本写的 upload-zone 的事件监听和 submitTask 等函数 ...
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

// src/static/app.js (完全体：全卡片 Uiverse 高级特效渲染)

function renderResult(data) {
    const resultZone = document.getElementById('result-zone');
    resultZone.innerHTML = ""; 
    
    // ================= 批处理模式渲染 =================
    if (data.current_node === 'batch_processing_subgraph') {
        let tableHTML = `
            <div class="opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]">
                <div class="bg-slate-800/80 backdrop-blur-xl rounded-[2rem] shadow-xl shadow-black/30 border border-slate-700/80 overflow-hidden">
                    <div class="px-8 py-6 border-b border-slate-700/80 bg-slate-800/50 flex items-center">
                        <div class="w-12 h-12 rounded-2xl bg-indigo-900/50 text-indigo-400 flex items-center justify-center text-2xl mr-5 shadow-[0_0_15px_rgba(79,70,229,0.3)] border border-indigo-700/50">📊</div>
                        <div>
                            <h2 class="text-2xl font-bold text-slate-100 tracking-tight">批处理分类结果</h2>
                            <p class="text-sm text-slate-400 font-medium mt-1">AI 已完成多行文本的智能打标与建议生成</p>
                        </div>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-slate-800/50">
                                <tr>
                                    <th scope="col" class="px-8 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider w-1/2">原文本</th>
                                    <th scope="col" class="px-8 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">分类标签</th>
                                    <th scope="col" class="px-8 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">AI 建议</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-700/50">
        `;
        data.batch_results.forEach(row => {
            tableHTML += `
                                <tr class="hover:bg-indigo-900/20 transition-colors duration-200">
                                    <td class="px-8 py-5 text-sm text-slate-300 font-medium leading-relaxed">${row.original}</td>
                                    <td class="px-8 py-5 text-sm whitespace-nowrap">
                                        <span class="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold bg-indigo-900/40 text-indigo-300 border border-indigo-700/50 shadow-sm">
                                            <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-2 shadow-[0_0_5px_#818cf8]"></span>
                                            ${row.category}
                                        </span>
                                    </td>
                                    <td class="px-8 py-5 text-sm text-slate-400 leading-relaxed">${row.suggestion}</td>
                                </tr>
            `;
        });
        tableHTML += `</tbody></table></div></div></div>`;
        resultZone.innerHTML = tableHTML;
        
    // ================= 深度研讨模式渲染 (全特效版) =================
    } else if (data.current_node === 'deep_analysis_subgraph') {
        const analysis = data.analysis_result;
        resultZone.innerHTML = `
            <div class="opacity-0 animate-[fadeIn_0.5s_ease-out_forwards] space-y-6">
                <div class="flex items-center px-2 mb-8">
                    <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white flex items-center justify-center text-3xl mr-5 shadow-[0_0_20px_rgba(124,58,237,0.4)] border border-indigo-400/30">📑</div>
                    <div>
                        <h2 class="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-indigo-300 tracking-tight">深度研讨诊断报告</h2>
                        <p class="text-slate-400 font-medium mt-1">Qwen 架构师级单案深度剖析</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                    <div class="h-full rounded-[2rem] bg-gradient-to-br from-rose-500 to-purple-600 transition-all duration-300 hover:shadow-[0_0_30px_1px_rgba(244,63,94,0.4)] group p-[2px]">
                        <div class="bg-[#1a1a1a] h-full w-full rounded-[calc(2rem-2px)] p-8 transition-transform duration-300 group-hover:scale-[0.98] relative overflow-hidden flex flex-col">
                            <h3 class="text-xl font-bold text-rose-400 mb-5 flex items-center shrink-0">
                                <div class="w-10 h-10 rounded-xl bg-rose-900/30 flex items-center justify-center mr-4 border border-rose-700/50 text-xl shadow-sm">🚨</div> 
                                痛点诊断
                            </h3>
                            <p class="text-rose-100/80 leading-relaxed font-medium text-[15px] grow">${analysis['痛点诊断']}</p>
                        </div>
                    </div>
                    
                    <div class="h-full rounded-[2rem] bg-gradient-to-br from-[#00ff75] to-[#3700ff] transition-all duration-300 hover:shadow-[0_0_30px_1px_rgba(0,255,117,0.4)] group p-[2px]">
                        <div class="bg-[#1a1a1a] h-full w-full rounded-[calc(2rem-2px)] p-8 transition-transform duration-300 group-hover:scale-[0.98] relative overflow-hidden flex flex-col">
                            <h3 class="text-xl font-bold text-[#00ff75] mb-5 flex items-center shrink-0">
                                <div class="w-10 h-10 rounded-xl bg-emerald-900/30 flex items-center justify-center mr-4 border border-[#00ff75]/30 text-xl shadow-sm">💡</div> 
                                解决方案
                            </h3>
                            <p class="text-emerald-100/80 leading-relaxed font-medium text-[15px] whitespace-pre-line grow">${analysis['解决方案']}</p>
                        </div>
                    </div>
                </div>

                <div class="rounded-[2rem] bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-600 transition-all duration-300 hover:shadow-[0_0_30px_1px_rgba(6,182,212,0.4)] group p-[2px]">
                    <div class="bg-[#1a1a1a] w-full rounded-[calc(2rem-2px)] p-8 transition-transform duration-300 group-hover:scale-[0.99] relative overflow-hidden flex flex-col">
                        <div class="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-indigo-500/10 blur-[50px] pointer-events-none"></div>

                        <h3 class="text-xl font-bold text-cyan-400 mb-5 flex items-center relative z-10">
                            <div class="w-10 h-10 rounded-xl bg-cyan-900/30 flex items-center justify-center mr-4 border border-cyan-700/50 text-xl shadow-sm">📌</div> 
                            提取事实原文
                        </h3>
                        <div class="relative z-10 pl-6 border-l-4 border-cyan-400 bg-gradient-to-r from-cyan-900/20 to-transparent py-5 pr-4 rounded-r-2xl group-hover:border-indigo-400 transition-colors duration-300">
                            <p class="text-slate-300 italic leading-relaxed font-medium text-[15px]">${analysis['事实']}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}