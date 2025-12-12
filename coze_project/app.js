// 全局变量
let videoFile = null;
let videoElement = null;
let frames = [];
let analysisResults = [];
let isProcessing = false;
let currentFrameRate = 1;

// DOM元素
const uploadArea = document.getElementById('uploadArea');
const videoInput = document.getElementById('videoInput');
const browseBtn = document.getElementById('browseBtn');
const videoPreview = document.getElementById('videoPreview');
const analyzeBtn = document.getElementById('analyzeBtn');
const resetBtn = document.getElementById('resetBtn');
const fpsRange = document.getElementById('fpsRange');
const fpsValue = document.getElementById('fpsValue');
const modelName = document.getElementById('modelName');
const apiEndpoint = document.getElementById('apiEndpoint');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const statusLog = document.getElementById('statusLog');
const frameGrid = document.getElementById('frameGrid');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const copyPromptsBtn = document.getElementById('copyPromptsBtn');
const frameViewer = document.getElementById('frameViewer');
const viewerImage = document.getElementById('viewerImage');
const viewerTime = document.getElementById('viewerTime');
const viewerPrompt = document.getElementById('viewerPrompt');
const closeViewer = document.getElementById('closeViewer');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // 事件监听器
    browseBtn.addEventListener('click', () => videoInput.click());
    videoInput.addEventListener('change', handleVideoUpload);
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('drop', handleDrop);
    fpsRange.addEventListener('input', updateFpsValue);
    analyzeBtn.addEventListener('click', startAnalysis);
    resetBtn.addEventListener('click', resetApp);
    exportJsonBtn.addEventListener('click', exportJson);
    exportCsvBtn.addEventListener('click', exportCsv);
    copyPromptsBtn.addEventListener('click', copyPrompts);
    closeViewer.addEventListener('click', () => frameViewer.style.display = 'none');
    
    // 初始状态
    updateFpsValue();
    addLogEntry('应用初始化完成');
}

// 处理视频上传
function handleVideoUpload(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('video/')) {
        processVideoFile(file);
    } else {
        alert('请选择有效的视频文件');
    }
}

// 处理拖放
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.style.borderColor = '#4cc9f0';
    uploadArea.style.background = 'rgba(67, 97, 238, 0.1)';
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.style.borderColor = '#4361ee';
    uploadArea.style.background = 'rgba(67, 97, 238, 0.05)';
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
        processVideoFile(file);
    } else {
        alert('请拖放有效的视频文件');
    }
}

// 处理视频文件
function processVideoFile(file) {
    if (file.size > 500 * 1024 * 1024) {
        alert('文件大小不能超过500MB');
        return;
    }
    
    videoFile = file;
    const videoURL = URL.createObjectURL(file);
    videoPreview.src = videoURL;
    videoPreview.style.display = 'block';
    
    addLogEntry(`视频已上传: ${file.name} (${formatFileSize(file.size)})`);
    
    // 初始化视频元素用于帧提取
    videoElement = document.createElement('video');
    videoElement.src = videoURL;
    videoElement.crossOrigin = 'anonymous';
}

// 更新FPS值显示
function updateFpsValue() {
    currentFrameRate = parseFloat(fpsRange.value);
    fpsValue.textContent = `${currentFrameRate} 帧/秒`;
}

// 开始分析
async function startAnalysis() {
    if (!videoFile) {
        alert('请先上传视频文件');
        return;
    }
    
    if (isProcessing) {
        alert('正在处理中，请稍候...');
        return;
    }
    
    // 重置结果
    frames = [];
    analysisResults = [];
    frameGrid.innerHTML = '';
    progressFill.style.width = '0%';
    progressText.textContent = '0%';
    progressContainer.style.display = 'block';
    
    isProcessing = true;
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 分析中...';
    
    addLogEntry('开始视频逐帧分析');
    
    try {
        // 提取视频帧
        await extractVideoFrames();
        
        // 为每帧生成AI提示词
        await generatePromptsForFrames();
        
        // 显示结果
        displayResults();
        
        addLogEntry('分析完成!');
    } catch (error) {
        console.error('分析错误:', error);
        addLogEntry(`分析失败: ${error.message}`, 'error');
        alert('分析过程中出现错误，请检查控制台');
    } finally {
        isProcessing = false;
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<i class="fas fa-play"></i> 开始逐帧分析';
    }
}

// 提取视频帧
async function extractVideoFrames() {
    return new Promise((resolve, reject) => {
        if (!videoElement) {
            reject(new Error('视频未加载'));
            return;
        }
        
        videoElement.addEventListener('loadeddata', () => {
            const duration = videoElement.duration;
            const totalFrames = Math.floor(duration * currentFrameRate);
            
            addLogEntry(`视频时长: ${formatTime(duration)}`);
            addLogEntry(`将提取约 ${totalFrames} 帧`);
            
            // 创建画布用于帧提取
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            let framesExtracted = 0;
            
            // 异步提取帧
            const extractNextFrame = () => {
                if (framesExtracted >= totalFrames) {
                    addLogEntry(`已提取 ${frames.length} 帧`);
                    resolve();
                    return;
                }
                
                const time = framesExtracted / currentFrameRate;
                
                // 设置视频时间
                videoElement.currentTime = time;
                
                // 等待视频定位到指定时间
                videoElement.onseeked = () => {
                    // 设置画布尺寸
                    canvas.width = videoElement.videoWidth;
                    canvas.height = videoElement.videoHeight;
                    
                    // 绘制当前帧
                    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                    
                    // 获取图像数据URL
                    const imageData = canvas.toDataURL('image/jpeg', 0.8);
                    
                    // 添加到帧数组
                    frames.push({
                        time: time,
                        timeFormatted: formatTime(time),
                        imageData: imageData,
                        index: framesExtracted
                    });
                    
                    // 更新进度
                    framesExtracted++;
                    const progress = Math.floor((framesExtracted / totalFrames) * 100);
                    progressFill.style.width = `${progress}%`;
                    progressText.textContent = `${progress}%`;
                    
                    // 继续提取下一帧
                    setTimeout(extractNextFrame, 10);
                };
            };
            
            // 开始提取
            extractNextFrame();
        });
        
        videoElement.load();
    });
}

// 为帧生成提示词
async function generatePromptsForFrames() {
    addLogEntry('正在为帧生成AI提示词...');
    
    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        
        // 模拟AI提示词生成 (实际应用中这里会调用火山引擎API)
        const prompt = await generateAIPrompt(frame.imageData, i);
        
        analysisResults.push({
            ...frame,
            prompt: prompt
        });
        
        // 更新进度
        const progress = Math.floor(((i + 1) / frames.length) * 100);
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${progress}%`;
        
        // 每10帧更新一次日志
        if (i % 10 === 0 || i === frames.length - 1) {
            addLogEntry(`已处理 ${i + 1}/${frames.length} 帧`);
        }
        
        // 添加延迟以避免阻塞UI
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}

// 模拟AI提示词生成 (实际应调用火山引擎API)
async function generateAIPrompt(imageData, frameIndex) {
    const promptStyle = document.getElementById('promptStyle').value;

    // 准备请求数据：去掉Base64前缀
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');

    try {
        // 关键修改：请求你自己的后端
        const response = await fetch('http://localhost:5000/api/analyze-frame', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_data: base64Data,
                prompt_style: promptStyle,
                frame_index: frameIndex
            })
        });

        const result = await response.json();

        if (result.success) {
            addLogEntry(`帧 ${frameIndex+1}: AI分析成功 (模型: ${result.model})`);
            return result.prompt;
        } else {
            throw new Error(result.error || '未知错误');
        }

    } catch (error) {
        console.error(`处理帧 ${frameIndex} 时出错:`, error);
        addLogEntry(`帧 ${frameIndex+1}: ${error.message}`, 'error');
        // 返回一个降级的描述
        return `[分析服务暂不可用] 这是视频的第 ${frameIndex+1} 帧画面。`;
    }
}
// 显示结果
// function displayResults() {
//     frameGrid.innerHTML = '';
    
//     analysisResults.forEach((result, index) => {
//         const frameItem = document.createElement('div');
//         frameItem.className = 'frame-item';
//         frameItem.dataset.index = index;
        
//         frameItem.innerHTML = `
//             <img src="${result.imageData}" class="frame-image" alt="帧 ${index}">
//             <div class="frame-prompt">${result.prompt.substring(0, 100)}...</div>
//         `;
        
//         // 点击查看大图
//         frameItem.addEventListener('click', () => {
//             viewerImage.src = result.imageData;
//             viewerTime.textContent = `时间: ${result.timeFormatted} (帧 ${index})`;
//             viewerPrompt.textContent = result.prompt;
//             frameViewer.style.display = 'flex';
//         });
        
//         frameGrid.appendChild(frameItem);
//     });
    
//     addLogEntry(`已显示 ${analysisResults.length} 个结果`);
// }
// 显示结果
function displayResults() {
    // 清空网格容器，移除旧的“空状态”提示
    frameGrid.innerHTML = '';
    
    // 遍历所有分析结果，为每一帧创建卡片
    analysisResults.forEach((result, index) => {
        const frameItem = document.createElement('div');
        frameItem.className = 'frame-item';
        frameItem.dataset.index = index;
        
        // 【新结构】生成卡片的HTML，包含头部、操作按钮、可展开的提示词框
        frameItem.innerHTML = `
            <div class="frame-header">
                <span class="frame-time">时间: ${result.timeFormatted}</span>
                <div class="frame-actions">
                    <button class="btn-copy" title="复制提示词">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="btn-expand" title="展开">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
            </div>
            <img src="${result.imageData}" class="frame-image" alt="帧 ${index + 1}">
            <div class="frame-prompt-container">
                <div class="frame-prompt-text" id="prompt-${index}">
                    ${result.prompt || '未获取到描述'}
                </div>
                <div class="prompt-footer">
                    <span class="prompt-length">字符数: <span class="char-count">${result.prompt ? result.prompt.length : 0}</span></span>
                    <span class="copy-status"></span>
                </div>
            </div>
        `;
        
        // --- 为卡片内的各个元素绑定交互事件 ---
        
        // 1. 图片点击：查看大图（功能保留，但事件绑定到图片本身，而非整个卡片）
        const imgElement = frameItem.querySelector('.frame-image');
        imgElement.addEventListener('click', () => {
            viewerImage.src = result.imageData;
            viewerTime.textContent = `时间: ${result.timeFormatted} (帧 ${index})`;
            viewerPrompt.textContent = result.prompt;
            frameViewer.style.display = 'flex';
        });
        
        // 2. 复制按钮：一键复制当前提示词
        const copyBtn = frameItem.querySelector('.btn-copy');
        const copyStatus = frameItem.querySelector('.copy-status');
        copyBtn.addEventListener('click', async (e) => {
            e.stopPropagation(); // 防止事件冒泡触发其他点击
            const promptText = result.prompt;
            if (!promptText) return;
            
            try {
                await navigator.clipboard.writeText(promptText);
                // 显示“已复制”反馈
                copyStatus.textContent = '已复制!';
                copyStatus.classList.add('show');
                // 2秒后隐藏反馈
                setTimeout(() => {
                    copyStatus.classList.remove('show');
                }, 2000);
            } catch (err) {
                console.error('复制失败: ', err);
                // 显示失败反馈
                copyStatus.textContent = '复制失败!';
                copyStatus.classList.add('show');
                setTimeout(() => {
                    copyStatus.classList.remove('show');
                }, 2000);
            }
        });
        
        // 3. 展开/收起按钮：控制提示词框的高度
        const expandBtn = frameItem.querySelector('.btn-expand');
        const promptTextEl = frameItem.querySelector('.frame-prompt-text');
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 防止事件冒泡
            const isExpanded = promptTextEl.classList.contains('expanded');
            if (isExpanded) {
                // 当前是展开状态，点击后收起
                promptTextEl.classList.remove('expanded');
                expandBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
                expandBtn.title = '展开';
            } else {
                // 当前是收起状态，点击后展开
                promptTextEl.classList.add('expanded');
                expandBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
                expandBtn.title = '收起';
            }
        });
        
        // 将创建好的卡片添加到网格容器中
        frameGrid.appendChild(frameItem);
    });
    
    // 如果没有任何结果，显示空状态提示（此逻辑现由resetApp处理，此处为保障健壮性）
    if (analysisResults.length === 0) {
        frameGrid.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px; color: #666; grid-column: 1 / -1;">
                <i class="fas fa-image" style="font-size: 3rem; margin-bottom: 15px;"></i>
                <p>分析结果将显示在这里</p>
                <p>每帧图像和对应的AI提示词</p>
            </div>
        `;
    }
    
    addLogEntry(`已生成 ${analysisResults.length} 个分析结果卡片`);
}
// 导出JSON
function exportJson() {
    if (analysisResults.length === 0) {
        alert('没有可导出的数据');
        return;
    }
    
    const dataStr = JSON.stringify({
        videoInfo: {
            name: videoFile?.name || '未知',
            frames: analysisResults.length,
            frameRate: currentFrameRate,
            modelUsed: modelName.value
        },
        frames: analysisResults
    }, null, 2);
    
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-analysis-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addLogEntry('已导出JSON文件');
}

// 导出CSV
function exportCsv() {
    if (analysisResults.length === 0) {
        alert('没有可导出的数据');
        return;
    }
    
    let csvContent = "帧序号,时间点(秒),时间格式,提示词\n";
    
    analysisResults.forEach(result => {
        const escapedPrompt = result.prompt.replace(/"/g, '""');
        csvContent += `${result.index},${result.time},"${result.timeFormatted}","${escapedPrompt}"\n`;
    });
    
    const dataBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(dataBlob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-analysis-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addLogEntry('已导出CSV文件');
}

// 复制提示词
function copyPrompts() {
    if (analysisResults.length === 0) {
        alert('没有可复制的提示词');
        return;
    }
    
    const promptsText = analysisResults.map(r => 
        `[${r.timeFormatted}] ${r.prompt}`
    ).join('\n\n');
    
    navigator.clipboard.writeText(promptsText).then(() => {
        addLogEntry('提示词已复制到剪贴板');
        alert('提示词已复制到剪贴板');
    }).catch(err => {
        console.error('复制失败:', err);
        alert('复制失败，请手动选择复制');
    });
}

// 重置应用
// 重置应用
function resetApp() {
    if (isProcessing) {
        if (!confirm('分析正在进行中，确定要重置吗？')) {
            return;
        }
    }
    
    videoFile = null;
    frames = [];
    analysisResults = [];
    
    videoPreview.src = '';
    videoPreview.style.display = 'none';
    videoInput.value = '';
    
    // 【修改这里】使用新的空状态HTML结构
    frameGrid.innerHTML = `
        <div class="empty-state" style="text-align: center; padding: 40px; color: #666; grid-column: 1 / -1;">
            <i class="fas fa-image" style="font-size: 3rem; margin-bottom: 15px;"></i>
            <p>分析结果将显示在这里</p>
            <p>每帧图像和对应的AI提示词</p>
        </div>
    `;
    
    progressContainer.style.display = 'none';
    progressFill.style.width = '0%';
    progressText.textContent = '0%';
    
    addLogEntry('应用已重置');
}

// 辅助函数
function addLogEntry(message, type = 'info') {
    const now = new Date();
    const timeString = now.toTimeString().split(' ')[0];
    
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    
    const color = type === 'error' ? '#f72585' : '#4cc9f0';
    
    logEntry.innerHTML = `
        <span class="log-time" style="color: ${color}">[${timeString}]</span> ${message}
    `;
    
    statusLog.appendChild(logEntry);
    statusLog.scrollTop = statusLog.scrollHeight;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 模拟火山引擎API调用 (实际实现需要替换)
async function callVolcanoEngineAPI(imageData, model) {
    // 实际实现中，这里需要:
    // 1. 获取API密钥 (应该从后端获取，不要在前端硬编码)
    // 2. 将图像数据转换为适当格式
    // 3. 发送请求到火山引擎API
    // 4. 处理响应
    
    // 示例代码结构:
    /*
    const apiKey = await getApiKeyFromBackend(); // 从后端获取密钥
    const endpoint = apiEndpoint.value || 'https://视觉理解API地址';
    
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            image: imageData.split(',')[1], // 移除data:image/jpeg;base64,前缀
            parameters: {
                // 额外参数
            }
        })
    });
    
    if (!response.ok) {
        throw new Error(`API调用失败: ${response.status}`);
    }
    
    const data = await response.json();
    return data.result.prompt; // 根据实际API响应结构调整
    */
    
    // 当前返回模拟响应
    return `火山引擎 ${model} 生成的提示词: [模拟响应]`;
}

// 初始化API状态检查
async function checkAPIStatus() {
    // 在实际应用中，这里会检查火山引擎API的连接状态
    // 模拟检查
    setTimeout(() => {
        const apiStatus = document.getElementById('apiStatus');
        apiStatus.classList.remove('offline');
        apiStatus.innerHTML = '<div class="status-dot"></div><span>火山引擎API: 就绪</span>';
    }, 1000);
}

// 启动API状态检查
checkAPIStatus();