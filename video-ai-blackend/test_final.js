// test_final.js - 简化版测试脚本
const axios = require('axios');

// ======【请在这里直接粘贴你的API Key和模型ID】======
const ARK_API_KEY = 'aip key'; // 例如: sk-abc123def456...
const MODEL_ID = 'id'; // 使用你实际的模型ID
// ==============================================

async function testConnection() {
    console.log('🧪 开始测试火山引擎API连通性...');
    console.log('使用的API Key前几位:', ARK_API_KEY.substring(0, Math.min(10, ARK_API_KEY.length)) + '...');
    console.log('使用的模型ID:', MODEL_ID);
    
    const requestBody = {
        "model": MODEL_ID,
        "input": [{
            "role": "user",
            "content": [{
                "type": "input_text",
                "text": "你好，请用一句话简单介绍你自己。"
            }]
        }]
    };
    
    console.log('🌐 发送请求到火山引擎API...');
    
    try {
        const response = await axios.post(
            'https://ark.cn-beijing.volces.com/api/v3/responses',//你的ai模型请求地址
            requestBody,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ARK_API_KEY}`
                },
                timeout: 10000 // 10秒超时
            }
        );
        
        console.log('✅ 测试成功！服务器返回结果:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // 提取并显示AI的回复内容
        if (response.data.output && response.data.output[0] && response.data.output[0].content) {
            console.log('\n🤖 AI回复内容:');
            console.log(response.data.output[0].content);
        }
        
    } catch (error) {
        console.error('\n❌ 测试失败！');
        console.error('错误状态码:', error.response?.status || '无响应');
        console.error('错误信息:');
        
        if (error.response && error.response.data) {
            console.log(JSON.stringify(error.response.data, null, 2));
            
            // 针对常见错误给出建议
            const errorCode = error.response.data.error?.code;
            if (errorCode === 'AuthenticationError') {
                console.log('\n💡 建议: 请检查ARK_API_KEY是否正确且完整，确保没有多余空格');
            } else if (errorCode === 'ModelNotFoundError') {
                console.log('\n💡 建议: 请检查MODEL_ID是否正确，或确认该模型是否已开通');
            }
        } else {
            console.log(error.message);
            
            if (error.code === 'ECONNREFUSED') {
                console.log('\n💡 建议: 网络连接问题，请检查防火墙或代理设置');
            }
        }
    }
}

// 运行测试
testConnection();
