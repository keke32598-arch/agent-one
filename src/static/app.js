// 登录界面--- 鉴权与路由流转控制 ---
async function handleLogin() {
    const userIn = document.getElementById('username').value;
    const passIn = document.getElementById('password').value;
    const btn = document.getElementById('login-btn');
    const errObj = document.getElementById('login-error');
    
    btn.innerHTML = `<div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>`;
    btn.disabled = true;
    errObj.classList.add('hidden');

    try {
        // FastAPI 的 OAuth2PasswordRequestForm 要求使用 URLSearchParams (表单形式)
        const params = new URLSearchParams();
        params.append('username', userIn);
        params.append('password', passIn);

        const res = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        if (!res.ok) throw new Error("账号或密码错误");

        const data = await res.json();
        
        // 【核心】：将数字钥匙存入浏览器本地
        localStorage.setItem('lk_token', data.access_token);
        localStorage.setItem('lk_role', data.role);
        localStorage.setItem('lk_dept', data.department);

        // 登录成功，执行场景分发
        enterWorkspace(data.role, data.department);

    } catch (err) {
        errObj.innerText = err.message;
        errObj.classList.remove('hidden');
        btn.innerHTML = `<span>系统登入</span>`;
        btn.disabled = false;
    }
}

// 根据身份进入不同的工作台
function enterWorkspace(role, dept) {
    // 1. 隐藏登录大门
    const overlay = document.getElementById('login-overlay');
    overlay.style.opacity = '0';
    setTimeout(() => overlay.classList.add('hidden'), 500);

    // 2. 显示主工作区
    const appContainer = document.getElementById('app-container');
    appContainer.classList.remove('hidden');

    // 3. 动态调整 UI 欢迎语
    const headerTitle = document.querySelector('header h1');
    const headerDesc = document.querySelector('header p');
    
    if (role === 'boss') {
        headerTitle.innerHTML = `<span class="text-indigo-400">店长</span>全局控制台`;
        headerDesc.innerText = `当前登录: Boss (最高权限) | 掌控全局工单分发与 AI 深度分析`;
        if (typeof fetchHistory === 'function') fetchHistory();
    } else {
        headerTitle.innerHTML = `<span class="text-amber-400">执行端</span>工作台`;
        headerDesc.innerText = `当前登录: ${dept} | 请及时处理店长派发的工单`;
        
        // 隐藏不属于员工的区域
        document.getElementById('upload-zone').classList.add('hidden');
        document.getElementById('history-zone').classList.add('hidden');
        
        // 触发拉取该员工所在部门的专属工单
        loadStaffTasks(); 
    }
}

// --- 核心：拉取并渲染员工专属任务池 ---
async function loadStaffTasks() {
    const resultZone = document.getElementById('result-zone');
    resultZone.innerHTML = `<div class="text-center text-amber-400 animate-pulse my-10 font-bold tracking-widest">正在同步部门工单数据...</div>`;
    
    const token = localStorage.getItem('lk_token');
    
    try {
        const response = await fetch('/api/v1/workorders', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error("无法拉取工单");
        
        const tasks = await response.json();
        
        if (tasks.length === 0) {
            resultZone.innerHTML = `<div class="text-center text-slate-500 my-20 font-bold border border-white/5 rounded-2xl bg-slate-900/40 p-10">🎉 太棒了，当前部门没有待处理的工单！</div>`;
            return;
        }

        // 极简风的员工任务列表渲染
        let html = `<div class="space-y-4 animate-[fadeIn_0.5s_ease-out_forwards]">`;
        tasks.forEach(task => {
            html += `
                <div class="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-6 flex justify-between items-center hover:border-amber-500/40 transition-all">
                    <div>
                        <div class="flex items-center space-x-3 mb-2">
                            <span class="w-2.5 h-2.5 rounded-full ${task.status === '待处理' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}"></span>
                            <h3 class="text-slate-100 font-bold text-lg">关联客诉指令: #${task.parent_task_id.substring(0,8)}</h3>
                        </div>
                        <p class="text-slate-400 text-sm">系统单号: ${task.id} | 下达时间: ${task.created_at}</p>
                    </div>
                    <button class="bg-amber-600/20 hover:bg-amber-600/40 border border-amber-500/30 text-amber-400 px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg hover:shadow-amber-500/20">
                        开始处理
                    </button>
                </div>
            `;
        });
        html += `</div>`;
        resultZone.innerHTML = html;
        
    } catch (error) {
        resultZone.innerHTML = `<div class="text-center text-rose-400 my-10">数据同步失败：${error.message}</div>`;
    }
}


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
    
    // UI 状态更新：显示顶部小黄条
    statusZone.classList.remove('hidden');
    statusZone.querySelector('span').innerText = `正在上传并分析: ${file.name} ...`;
    
    // 【核心新增】立即展示赛博风 Loading 动画，占据结果区
    resultZone.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 animate-pulse">
            <div class="w-20 h-20 border-4 border-t-indigo-500 border-indigo-900/30 rounded-full animate-spin mb-6"></div>
            <p class="text-indigo-400 font-bold text-xl tracking-widest">AGENT 正在分析中...</p>
            <p class="text-slate-500 text-sm mt-2">正在解析文档并生成智能建议，请稍候</p>
        </div>
    `;

    // 核心改变：使用 FormData 封装二进制文件
    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch('/api/v1/agent/submit', {
            method: 'POST',
            body: formData 
        });
        
        if (!response.ok) throw new Error(`HTTP 错误! 状态码: ${response.status}`);
        
        const data = await response.json();
        // 开始轮询
        pollStatus(data.task_id);
    } catch (err) {
        statusZone.classList.replace('bg-blue-50', 'bg-red-50');
        statusZone.classList.replace('text-blue-700', 'text-red-700');
        statusZone.querySelector('span').innerText = "提交失败: " + err.message;
        resultZone.innerHTML = ""; // 失败时清空 Loading
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
                    // 1. 任务完成，清除定时器并隐藏顶部黄条
                    clearInterval(interval);
                    statusZone.classList.add('hidden'); 
                    
                    // 2. 自动渲染结果 (兼容 data.result 和 data.data)
                    renderResult(data.result || data.data); 
                    
                    // 3. 【核心新增】自动刷新下方的历史记录列表
                    if (typeof fetchHistory === 'function') {
                        fetchHistory();
                    }

                    // 4. 【核心新增】自动平滑滚动到结果区域
                    document.getElementById('result-zone').scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start' 
                    });

                } else if (data.status === 'failed') {
                    // 【核心新增】失败状态处理
                    clearInterval(interval);
                    statusZone.classList.add('hidden');
                    document.getElementById('result-zone').innerHTML = `
                        <div class="text-center text-rose-400 py-10 border border-rose-900/50 rounded-2xl bg-rose-900/10">
                            <p class="text-xl font-bold">分析失败</p>
                            <p class="text-sm opacity-70 mt-2">${data.error || '大模型处理或解析异常'}</p>
                        </div>
                    `;
                } else {
                    // 更新进度提示
                    statusZone.querySelector('span').innerText = `正在处理中，请耐心等候哟😊`;
                }
            }
        } catch (err) {
            console.error("轮询失败", err);
            clearInterval(interval);
        }
    }, 1000);
}

// src/static/app.js (完全体：全卡片 Uiverse 高级特效渲染)

// --- 在外层定义一个全局记忆体，暂存当前正在看的数据 ---
let currentBatchData = null;

function renderResult(data) {
    const resultZone = document.getElementById('result-zone');
    resultZone.innerHTML = ""; 
    
    // ================= 批处理模式渲染 =================
if (data.current_node === 'batch_processing_subgraph') {
        currentBatchData = data.batch_results;

        let tableHTML = `
            <div class="opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]">
                <div class="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-black/40 border border-white/10 overflow-hidden">
                    
                    <div class="px-10 py-8 border-b border-white/10 bg-slate-900/50 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                        <div class="flex items-center">
                            <div class="w-14 h-14 rounded-2xl bg-indigo-900/40 text-indigo-400 flex items-center justify-center text-3xl mr-6 shadow-[0_0_20px_rgba(79,70,229,0.2)] border border-indigo-500/30">📊</div>
                            <div>
                                <h2 class="text-2xl font-bold text-slate-100 tracking-tight">批处理分类结果</h2>
                                <p class="text-sm text-slate-400 font-medium mt-1">AI 已完成多行文本的智能打标与建议生成</p>
                            </div>
                        </div>
                        
                        <button onclick="exportToExcel(this)" 
                                class="flex items-center px-5 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 rounded-xl transition-all duration-300 group shadow-lg hover:shadow-indigo-500/20 shrink-0">
                            <svg class="w-5 h-5 mr-2 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                            </svg>
                            <span class="font-bold text-sm">导出 Excel</span>
                        </button>
                    </div>

                    <div class="px-10 py-6 border-b border-white/5 bg-slate-900/20 relative">
                        <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
                            <span class="text-6xl font-black italic tracking-widest text-indigo-500">DISTRIBUTION</span>
                        </div>
                        <div id="batch-chart" class="w-full h-64 relative z-10"></div>
                    </div>

                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-slate-900/50">
                                <tr>
                                    <th scope="col" class="px-8 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider w-1/2">原文本</th>
                                    <th scope="col" class="px-8 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">分类标签</th>
                                    <th scope="col" class="px-8 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">AI 建议</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-white/5">
        `;
        
        data.batch_results.forEach(row => {
            tableHTML += `
                                <tr class="hover:bg-white/5 transition-colors duration-200">
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
        // 【核心新增】：等待 DOM 渲染完毕后，提取内存数据画图
        setTimeout(() => {
            renderBatchChart(currentBatchData);
        }, 50);
    // ================= 深度研讨模式渲染 (全息亚克力 + 流式打字机版) =================
   } else if (data.current_node === 'deep_analysis_subgraph') {
        const analysis = data.analysis_result;
        resultZone.innerHTML = `
            <div class="opacity-0 animate-[fadeIn_0.5s_ease-out_forwards] space-y-6">
                <div class="flex items-center px-4 mb-8">
                    <div class="w-14 h-14 rounded-2xl bg-indigo-900/40 text-indigo-400 flex items-center justify-center text-3xl mr-6 shadow-[0_0_20px_rgba(79,70,229,0.2)] border border-indigo-500/30">📑</div>
                    <div>
                        <h2 class="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-indigo-300 tracking-tight">深度研讨诊断报告</h2>
                        <p class="text-slate-400 font-medium mt-1 tracking-wide">Qwen 架构师级单案深度剖析</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                    <div class="h-full bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-white/10 p-8 transition-all duration-300 hover:border-rose-500/40 hover:shadow-[0_0_30px_rgba(244,63,94,0.15)] hover:-translate-y-1 group relative overflow-hidden flex flex-col">
                        <div class="absolute -top-20 -right-20 w-40 h-40 bg-rose-500/10 rounded-full blur-[50px] pointer-events-none transition-opacity opacity-50 group-hover:opacity-100"></div>
                        <h3 class="text-xl font-bold text-slate-100 mb-6 flex items-center shrink-0">
                            <div class="w-12 h-12 rounded-2xl bg-rose-900/30 flex items-center justify-center mr-4 border border-rose-500/30 text-rose-400 text-xl shadow-[0_0_15px_rgba(244,63,94,0.2)]">🚨</div> 
                            <span class="group-hover:text-rose-400 transition-colors">痛点诊断</span>
                        </h3>
                        <p id="stream-pain" class="text-slate-300 leading-relaxed font-medium text-[15px] whitespace-pre-line grow relative z-10"></p>
                    </div>
                    
                    <div class="h-full bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-white/10 p-8 transition-all duration-300 hover:border-emerald-500/40 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] hover:-translate-y-1 group relative overflow-hidden flex flex-col">
                        <div class="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-[50px] pointer-events-none transition-opacity opacity-50 group-hover:opacity-100"></div>
                        <h3 class="text-xl font-bold text-slate-100 mb-6 flex items-center shrink-0">
                            <div class="w-12 h-12 rounded-2xl bg-emerald-900/30 flex items-center justify-center mr-4 border border-emerald-500/30 text-emerald-400 text-xl shadow-[0_0_15px_rgba(16,185,129,0.2)]">💡</div> 
                            <span class="group-hover:text-emerald-400 transition-colors">解决方案</span>
                        </h3>
                        
                        <p id="stream-solution" class="text-slate-300 leading-relaxed font-medium text-[15px] whitespace-pre-line grow relative z-10"></p>
                    </div>
                </div>

                <div class="bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-white/10 p-8 transition-all duration-300 hover:border-cyan-500/40 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] hover:-translate-y-1 group relative overflow-hidden flex flex-col">
                    <h3 class="text-xl font-bold text-slate-100 mb-6 flex items-center relative z-10">
                        <div class="w-12 h-12 rounded-2xl bg-cyan-900/30 flex items-center justify-center mr-4 border border-cyan-500/30 text-cyan-400 text-xl shadow-[0_0_15px_rgba(6,182,212,0.2)]">📌</div> 
                        <span class="group-hover:text-cyan-400 transition-colors">提取事实原文</span>
                    </h3>
                    <div class="relative z-10 pl-6 border-l-4 border-cyan-500/50 bg-cyan-900/10 py-5 pr-6 rounded-r-2xl group-hover:border-cyan-400 transition-colors duration-300">
                        <p id="stream-fact" class="text-slate-400 italic leading-relaxed font-medium text-[15px]"></p>
                    </div>
                </div>
            </div>
        `;
        // 【核心触发】：利用回调函数，实现“接力赛”式的逐个打印！
        setTimeout(() => {
            // 先打印“事实” (速度 25ms/字)
            typeWriterEffect('stream-fact', analysis['事实'], 25, () => {
                // 事实打印完后，打印“痛点” (稍微放慢，30ms/字，营造深思熟虑感)
                typeWriterEffect('stream-pain', analysis['痛点诊断'], 30, () => {
                    // 最后打印“解决方案” (提速，20ms/字，雷厉风行)
                    typeWriterEffect('stream-solution', analysis['解决方案'], 20);
                });
            });
        }, 300); // 留出 300ms 给卡片本身的淡入动画
    }
}
// --- Task 3: 异步获取并渲染日志 ---
async function fetchChangelog() {
    try {
        const response = await fetch('/api/v1/changelog');
        const logs = await response.json();
        renderChangelog(logs);
    } catch (error) {
        console.error("加载更新日志失败:", error);
    }
}

function renderChangelog(logs) {
    const container = document.getElementById('changelog-zone');
    if (!container) return;

    let html = `
       <div class="bg-slate-900/0 rounded-[2.5rem] shadow-2xl shadow-black/40 border border-white/10 overflow-hidden animate-[fadeIn_0.8s_ease-out]">
           <div class="px-10 py-8 border-b border-white/10 bg-slate-900/50 flex items-center">

                <div>
                    <h2 class="text-2xl font-bold text-slate-50 tracking-tight">日志</h2>
                    <p class="text-sm text-slate-400 font-medium mt-1">我有话说！！！</p>
                </div>
            </div>
            
            <div class="p-10 space-y-10">
    `;

    logs.forEach(log => {
        html += `
            <div class="flex items-start space-x-6 group">
                <div class="shrink-0 w-28 pt-1.5">
                    <span class="text-[20px] font-black text-emerald-500/70 tracking-tighter uppercase font-mono">${log.date}</span>
                </div>
                <div class="relative pl-8 border-l border-white/10 pb-2">
                    <div class="absolute left-[-5px] top-3 w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(52,211,153,0.8)] transition-transform group-hover:scale-125"></div>
                    <h3 class="text-slate-100 font-bold text-lg mb-2 group-hover:text-emerald-400 transition-colors">${log.version}</h3>
                    <p class="text-slate-400 text-[15px] leading-relaxed max-w-2xl">${log.content}</p>
                </div>
            </div>
        `;
    });

    html += `</div></div>`;
    container.innerHTML = html;
}

// 确保在页面加载后调用
window.addEventListener('DOMContentLoaded', fetchChangelog);




// --- 记忆持久化：获取并渲染历史任务 ---
async function fetchHistory() {
    try {
        const response = await fetch('/api/v1/tasks');
        const tasks = await response.json();
        renderHistory(tasks);
    } catch (error) {
        console.error("加载历史记录失败:", error);
    }
}

// --- 记忆持久化：带模式过滤的极简历史记录 ---

// 1. 引入全局状态，记忆当前数据和选中的 Tab
let globalHistoryTasks = [];
let currentHistoryTab = 'batch_processing_subgraph'; // 默认开机显示批处理记录

async function fetchHistory() {
    try {
        const response = await fetch('/api/v1/tasks');
        globalHistoryTasks = await response.json();
        renderHistory(); // 数据拉取后，触发一次过滤渲染
    } catch (error) {
        console.error("加载历史记录失败:", error);
    }
}

// 2. 核心绑定的切换动作
window.switchHistoryTab = function(mode) {
    currentHistoryTab = mode;
    renderHistory(); // 切换 Tab 时瞬间重新画 UI
};

function renderHistory() {
    const container = document.getElementById('history-zone');
    if (!container || globalHistoryTasks.length === 0) {
        if(container) container.innerHTML = '';
        return;
    }

    // 3. 动态过滤出当前模式的数据（刚建立的未知任务两边都展示，防止丢失）
    const filteredTasks = globalHistoryTasks.filter(task => {
        if (task.mode === 'unknown') return true; 
        return task.mode === currentHistoryTab;
    });

    // 4. 极致的切换按钮样式计算 (选中时泛起靛蓝色，未选中时低调隐形)
    const batchBtnClass = currentHistoryTab === 'batch_processing_subgraph' 
        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 shadow-[0_0_10px_rgba(79,70,229,0.2)]' 
        : 'text-slate-500 hover:text-slate-300 border-transparent';
        
    const deepBtnClass = currentHistoryTab === 'deep_analysis_subgraph' 
        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 shadow-[0_0_10px_rgba(79,70,229,0.2)]' 
        : 'text-slate-500 hover:text-slate-300 border-transparent';

    let html = `
        <div class="bg-slate-900/40 rounded-[1.5rem] shadow-lg border border-white/10 overflow-hidden mb-8 animate-[fadeIn_0.5s_ease-out]">
            
            <div class="px-6 py-4 border-b border-white/10 bg-slate-900/50 flex flex-col md:flex-row justify-between items-center space-y-3 md:space-y-0">
                <div class="flex items-center space-x-6">
                    <div class="flex items-center">
                        <span class="text-indigo-400 mr-2.5 text-lg">💾</span>
                        <h2 class="text-sm font-bold text-slate-200 tracking-tight hidden md:block">档案库</h2>
                    </div>
                    
                    <div class="flex bg-slate-950/60 p-1 rounded-xl border border-white/5 shadow-inner">
                        <button onclick="switchHistoryTab('batch_processing_subgraph')" class="px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 border ${batchBtnClass}">批处理模式</button>
                        <button onclick="switchHistoryTab('deep_analysis_subgraph')" class="px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 border ${deepBtnClass}">深度研讨模式</button>
                    </div>
                </div>
                
                <span class="text-[9px] font-mono text-slate-500 uppercase tracking-widest">${filteredTasks.length} RECORDS</span>
            </div>
            
            <div class="p-2 space-y-1 max-h-64 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-slate-700/50 [&::-webkit-scrollbar-thumb]:rounded-full">
    `;

    if (filteredTasks.length === 0) {
        html += `<div class="text-center text-slate-500 text-xs py-8 font-medium">此模式下暂无归档记录</div>`;
    } else {
        filteredTasks.forEach(task => {
            const dateObj = new Date(task.created_at + 'Z'); 
            const timeStr = `${dateObj.getMonth()+1}/${dateObj.getDate()} ${dateObj.getHours()}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
            const isSuccess = task.status === 'completed';
            const isRunning = task.status === 'running';
            const statusColor = isSuccess ? 'bg-emerald-500' : (isRunning ? 'bg-amber-500' : 'bg-rose-500');
            const statusGlow = isSuccess ? 'shadow-[0_0_8px_rgba(16,185,129,0.4)]' : (isRunning ? 'shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'shadow-[0_0_8px_rgba(244,63,94,0.4)]');

            html += `
                <div onclick="loadHistoricalTask('${task.id}')" 
                     class="group flex items-center justify-between px-4 py-2 rounded-xl bg-transparent hover:bg-white/5 transition-all duration-200 cursor-pointer border border-transparent hover:border-white/5">
                    
                    <div class="flex items-center space-x-4">
                        <div class="w-1.5 h-1.5 rounded-full ${statusColor} ${statusGlow}"></div>
                        <span class="text-[11px] font-mono text-slate-500 group-hover:text-indigo-400 transition-colors uppercase">#${task.id.substring(0, 6)}</span>
                    </div>

                    <span class="text-[11px] font-medium text-slate-500 group-hover:text-slate-300 transition-colors tracking-tight">${timeStr}</span>
                </div>
            `;
        });
    }

    html += `</div></div>`;
    container.innerHTML = html;
}
// 点击历史任务，直接拉取报告并渲染
async function loadHistoricalTask(taskId) {
    // 滚动到顶部，准备展示结果
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const resultZone = document.getElementById('result-zone');
    resultZone.innerHTML = `<div class="text-center text-indigo-400 animate-pulse my-10">正在从记忆体中提取分析报告...</div>`;
    
    try {
        const response = await fetch(`/api/v1/agent/status/${taskId}`);
        if (!response.ok) throw new Error("无法读取该记录");
        const data = await response.json();
        
        if (data.status === 'completed') {
            renderResult(data.result); // 复用现有的炫酷渲染函数！
        } else {
            resultZone.innerHTML = `<div class="text-center text-rose-400 my-10">该任务状态异常或未完成。</div>`;
        }
    } catch (error) {
        resultZone.innerHTML = `<div class="text-center text-rose-400 my-10">记忆提取失败：${error.message}</div>`;
    }
}

// 确保页面加载时除了加载 changelog，也加载 history
window.addEventListener('DOMContentLoaded', () => {
    fetchHistory();
    // 如果之前有 fetchChangelog()，记得确保它们都能执行
});

// --- 前端文件流下载逻辑 (优雅版) ---
async function exportToExcel(btnElement) {
    try {
        // 直接从内存中读取数据，安全且不会撑爆 HTML
        if (!currentBatchData || currentBatchData.length === 0) {
            alert("目前没有可导出的数据！");
            return;
        }

        const originalText = btnElement.innerHTML;
        btnElement.innerHTML = "正在生成...";
        btnElement.disabled = true;

       const response = await fetch('/api/v1/export/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // 【核心修改】：给数组套上 { results: ... } 外壳，完美迎合后端的 Pydantic 模型
            body: JSON.stringify({ results: currentBatchData })
        });

        if (!response.ok) throw new Error("导出请求失败");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        const timestamp = new Date().getTime();
        a.href = url;
        a.download = `LK_Analysis_Report_${timestamp}.xlsx`;
        document.body.appendChild(a);
        a.click();
        
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        btnElement.innerHTML = originalText;
        btnElement.disabled = false;
    } catch (error) {
        console.error("导出失败:", error);
        alert("导出失败，请检查控制台");
    }
}

// --- 数据看板：渲染带微光特效的分类统计环形图 ---
function renderBatchChart(dataList) {
    const chartDom = document.getElementById('batch-chart');
    if (!chartDom) return;

    // 1. 自动聚合数据：计算每个分类有多少条
    const categoryCounts = {};
    dataList.forEach(item => {
        // 如果分类是空的或者未定义，给个默认值
        const cat = item.category || '未分类';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const chartData = Object.keys(categoryCounts).map(key => ({
        name: key,
        value: categoryCounts[key]
    }));

    // 2. 初始化 ECharts 实例
    const myChart = echarts.init(chartDom);

    // 3. 极客赛博风格配置
    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(15, 23, 42, 0.9)', // 极深蓝底色
            borderColor: 'rgba(99, 102, 241, 0.4)', // 靛蓝边框
            textStyle: { color: '#f8fafc' },
            formatter: '{b}: {c} 项 ({d}%)' // 悬停显示名称、数量和百分比
        },
        legend: {
            top: 'middle',
            right: '5%',
            orient: 'vertical',
            textStyle: { color: '#cbd5e1', fontSize: 14, fontWeight: 'bold' },
            icon: 'circle',
            itemGap: 20
        },
        // 赛博霓虹色系：靛蓝、祖母绿、玫瑰红、天蓝、琥珀黄
        color: ['#6366f1', '#10b981', '#f43f5e', '#0ea5e9', '#f59e0b', '#8b5cf6'],
        series: [
            {
                name: '客诉分类',
                type: 'pie',
                radius: ['55%', '85%'], // 设置为环形图 (甜甜圈形状)
                center: ['35%', '50%'], // 整体偏左一点，把右边留给图例
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 15, // 圆角切割
                    borderColor: 'rgba(15, 23, 42, 0.8)', // 玻璃缝隙
                    borderWidth: 4,
                    // 【核心质感】：悬浮发光特效
                    shadowBlur: 20,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                },
                label: { show: false }, // 隐藏自带的标签，保持极简
                labelLine: { show: false },
                data: chartData
            }
        ]
    };

    myChart.setOption(option);

    // 监听浏览器窗口缩放，让图表永远保持响应式自适应
    window.addEventListener('resize', () => myChart.resize());
}

// --- 流式输出：异步黑客打字机引擎 ---虚假流式输出，模拟真实打字效果
function typeWriterEffect(elementId, text, baseSpeed, callback) {
    const element = document.getElementById(elementId);
    if (!element || !text) {
        if (callback) callback();
        return;
    }
    
    element.innerHTML = ""; // 清空原有内容
    let i = 0;
    
    // 添加一个赛博朋克光标
    const cursor = document.createElement('span');
    cursor.className = 'inline-block w-2 h-4 ml-1 bg-indigo-500 animate-pulse';
    element.appendChild(cursor);

    function type() {
        if (i < text.length) {
            // 在光标前面插入文字，完美支持换行符 \n
            const char = text.charAt(i);
            const textNode = document.createTextNode(char);
            element.insertBefore(textNode, cursor);
            
            i++;
            // 引入随机延迟 (±10ms)，模拟真实的打字机节奏
            const randomSpeed = baseSpeed + (Math.random() * 20 - 10);
            setTimeout(type, randomSpeed);
        } else {
            // 打字结束，移除光标，并执行下一个动作
            cursor.remove();
            if (callback) callback();
        }
    }
    
    // 稍微延迟一下再开始敲字，感觉更真实
    setTimeout(type, 200);
}

// --- 业务流转：老板端发起派单 (真·数据请求版) ---
async function dispatchTask(taskId) {
    const roleSelector = document.getElementById('role-selector');
    if (!roleSelector) return;
    
    const targetDept = roleSelector.value;
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    
    btn.innerHTML = `<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>`;
    btn.disabled = true;

    try {
        const token = localStorage.getItem('lk_token');
        if (!token) throw new Error("登录已失效，请重新登录");

        const response = await fetch('/api/v1/workorders', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                parent_task_id: taskId,
                assignee_dept: targetDept,
                instructions: "请依据 AI 诊断报告尽快执行处理闭环。"
            })
        });

        if (!response.ok) throw new Error("派单失败");

        btn.innerHTML = "已成功派发 ✓";
        btn.classList.replace('bg-indigo-600', 'bg-emerald-600');
    } catch (error) {
        alert(error.message);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// --- 业务流转：员工端拉取专属任务 ---
async function loadStaffTasks() {
    const resultZone = document.getElementById('result-zone');
    resultZone.innerHTML = `<div class="text-center text-amber-400 animate-pulse my-10 font-bold tracking-widest">正在同步部门工单数据...</div>`;
    
    const token = localStorage.getItem('lk_token');
    try {
        const response = await fetch('/api/v1/workorders', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const tasks = await response.json();
        
        if (tasks.length === 0) {
            resultZone.innerHTML = `<div class="text-center text-slate-500 my-20 font-bold border border-white/5 rounded-2xl bg-slate-900/40 p-10">🎉 当前部门没有待处理的工单</div>`;
            return;
        }

        let html = `<div class="space-y-4 animate-[fadeIn_0.5s_ease-out]">`;
        tasks.forEach(task => {
            html += `
                <div class="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-6 flex justify-between items-center hover:border-amber-500/40 transition-all">
                    <div>
                        <div class="flex items-center space-x-3 mb-2">
                            <span class="w-2.5 h-2.5 rounded-full ${task.status === '待处理' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}"></span>
                            <h3 class="text-slate-100 font-bold text-lg">关联客诉: #${task.parent_task_id.substring(0,8)}</h3>
                        </div>
                        <p class="text-slate-400 text-sm">单号: ${task.id} | 下达: ${task.created_at}</p>
                    </div>
                    <button class="bg-amber-600/20 hover:bg-amber-600/40 border border-amber-500/30 text-amber-400 px-6 py-2.5 rounded-xl font-bold">开始处理</button>
                </div>`;
        });
        resultZone.innerHTML = html + `</div>`;
    } catch (error) {
        resultZone.innerHTML = `<div class="text-center text-rose-400 my-10">数据同步失败</div>`;
    }
}