const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto'); // 用于生成请求ID
const app = express();
const PORT = process.env.PORT || 5000;

// 从环境变量读取密钥（根据Python示例，这里应该是一个API KEY）
const ARK_API_KEY="3086ae99-94ca-46ef-b2a1-4f9821de292b"; // 注意变量名变化
const VOLC_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3';
const MODEL_ID = 'ep-20251210223007-zmtn5'; // 与示例一致

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 辅助函数：生成符合火山引擎要求的请求ID格式
function generateRequestId() {
    return `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

// 修改后的API调用函数
async function callVolcanoModel(imageBase64, promptStyle) {
    // 根据示例，构造正确的请求体
    const requestBody = {
        "model": MODEL_ID,
        "input": [ // 注意：这里是input，不是messages
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_image", // 注意类型名称
                        "image_url": `data:image/jpeg;base64,${imageBase64}`
                    },
                    {
                        "type": "input_text", // 注意类型名称
                        "text": `请用${promptStyle}风格详细描述这张图片中的场景、物体、色彩、光线和构图。`
                    }
                ]
            }
        ]
        // 可以根据需要添加其他参数，如"stream", "parameters"等
    };

    // 生成请求ID
    const requestId = generateRequestId();
    
    // 配置请求头（根据Python SDK示例，只需要API Key）
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ARK_API_KEY}`, // 简单的Bearer Token认证
            'X-Request-Id': requestId // 可选，但推荐添加用于追踪
        },
        timeout: 120000 // 30秒超时
    };

    const url = `${VOLC_ENDPOINT}/responses`; // 注意端点路径
    console.log(`发送请求到: ${url}, 模型: ${MODEL_ID}`);
    
    try {
        const response = await axios.post(url, requestBody, config);
        return response.data;
    } catch (error) {
        // 更详细的错误信息
        console.error('API请求失败详情:');
        console.error('- 状态码:', error.response?.status);
        console.error('- 错误信息:', error.response?.data || error.message);
        console.error('- 请求ID:', requestId);
        throw error;
    }
}

// 提供给前端的分析接口
app.post('/api/analyze-frame', async (req, res) => {
    try {
        const { image_data, prompt_style, frame_index } = req.body;

        if (!image_data) {
            return res.status(400).json({ error: '未提供图片数据' });
        }

        console.log(`正在处理第 ${frame_index} 帧...`);
        
        // 调用火山引擎API
        const volcResult = await callVolcanoModel(image_data, prompt_style);
        console.log('完整的API响应:', JSON.stringify(volcResult, null, 2));
        // 解析API返回的内容（注意数据结构可能有所不同）
        // 根据Python示例，response直接包含输出内容，您可能需要根据实际响应调整
        // let aiDescription;
        // if (volcResult.output && volcResult.output.length > 0) {
        //     // 假设响应结构与Python示例类似
        //     aiDescription = volcResult.output[0]?.content || '未获取到描述';
        // } else if (volcResult.choices && volcResult.choices.length > 0) {
        //     // 备用解析方式
        //     aiDescription = volcResult.choices[0].message.content;
        // } else {
        //     aiDescription = JSON.stringify(volcResult);
        // }

        // res.json({
        //     success: true,
        //     prompt: aiDescription,
        //     model: MODEL_ID,
        //     frame_index: frame_index,
        //     request_id: volcResult.request_id || '未知'
        // });

        let aiDescription = '未获取到描述'; // 默认值

// 方案1：优先尝试获取最终的“assistant”消息文本
        if (volcResult.output && Array.isArray(volcResult.output)) {
            // 查找类型为 "message" 且角色为 "assistant" 的输出项
            const assistantMessage = volcResult.output.find(item => 
                item.type === 'message' && item.role === 'assistant'
            );
            
            if (assistantMessage && assistantMessage.content && Array.isArray(assistantMessage.content)) {
                // 查找类型为 "output_text" 的内容项
                const textContent = assistantMessage.content.find(item => item.type === 'output_text');
                if (textContent && textContent.text) {
                    aiDescription = textContent.text;
                }
            }
        }

        // 方案2：备选方案，获取推理总结（如果只需要简洁描述）
        if (aiDescription === '未获取到描述') {
            const reasoningItem = volcResult.output.find(item => item.type === 'reasoning');
            if (reasoningItem && reasoningItem.summary && Array.isArray(reasoningItem.summary)) {
                const summaryText = reasoningItem.summary.find(s => s.type === 'summary_text');
                if (summaryText && summaryText.text) {
                    // 取总结的前500个字符作为描述
                    aiDescription = summaryText.text.substring(0, 500) + (summaryText.text.length > 500 ? '...' : '');
                }
            }
        }
        // ======================================

        res.json({
            success: true,
            prompt: aiDescription,
            model: MODEL_ID,
            frame_index: frame_index,
            request_id: volcResult.id || '未知'
        });

    } catch (error) {
        console.error('调用火山引擎API失败:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: 'AI服务处理失败',
            detail: error.response?.data?.message || error.message,
            frame_index: req.body.frame_index
        });
    }
});

app.listen(PORT, () => {
    console.log(`后端代理服务运行在 http://localhost:${PORT}`);
    console.log(`请确保已设置环境变量 ARK_API_KEY`);
    console.log(`使用模型: ${MODEL_ID}`);
});

