// src/llmClient.ts
import * as vscode from 'vscode';
// 必须使用 require 导入 node-fetch v2 以避免 ESM/CJS 冲突，或者配合 tsconfig 使用 import
// 为了最大兼容性，在 TS 中使用 import，但确保安装的是 @types/node-fetch@2
// 推荐改为这一行，兼容性最强
const fetch = require('node-fetch'); 

interface ChatCompletionResponse {
    choices: {
        message: {
            content: string;
        };
    }[];
    error?: {
        message: string;
        type: string;
    };
}

export async function callLLMApi(prompt: string): Promise<string> {
    const config = vscode.workspace.getConfiguration('smellcc');
    
    // 1. 获取配置
    const apiKey = config.get<string>('apiKey');
    const modelName = config.get<string>('model') || "deepseek-coder";
    let baseUrl = config.get<string>('apiBaseUrl');

    // 默认值处理
    if (!baseUrl || baseUrl.trim() === "") {
        baseUrl = "https://api.deepseek.com"; // 默认指向 DeepSeek 官方
    }

    // 2. URL 规范化处理：确保以 /chat/completions 结尾
    // 移除末尾斜杠
    baseUrl = baseUrl.replace(/\/+$/, '');
    
    let apiUrl = "";
    if (baseUrl.endsWith('/chat/completions')) {
        apiUrl = baseUrl;
    } else if (baseUrl.endsWith('/v1')) {
        apiUrl = `${baseUrl}/chat/completions`;
    } else {
        // 假设用户只填了域名，尝试补全标准路径
        // 比如用户填 https://api.deepseek.com -> https://api.deepseek.com/chat/completions
        // 注意：DeepSeek 官方有时候是 /chat/completions，有时候是 /v1/chat/completions，视具体 Base URL 而定
        // 为了通用性，我们检查是否包含 v1，如果不包含且不是 localhost，通常补一个
        if (!baseUrl.includes('/v1')) {
             // 尝试智能补全，或者直接补全 endpoint。最稳妥是补全 /chat/completions
             // 如果用户填的是 https://api.deepseek.com，deepseek 实际上接受 https://api.deepseek.com/chat/completions
             apiUrl = `${baseUrl}/chat/completions`;
        } else {
             apiUrl = `${baseUrl}/chat/completions`;
        }
    }
    
    console.log(`[SMELLCC] Calling LLM at: ${apiUrl} with model: ${modelName}`);

    if (!apiKey) {
        vscode.window.showErrorMessage("SMELLCC: API Key is missing! Please configure 'smellcc.apiKey' in settings.");
        throw new Error("API Key missing");
    }

    const payload = {
        model: modelName,
        messages: [
            { role: "user", content: prompt }
        ],
        temperature: 0, // 论文设定
        stream: false
    };

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[SMELLCC API Error] Status: ${response.status}, Body: ${errText}`);
            throw new Error(`API Error (${response.status}): ${errText}`);
        }

        const data = await response.json() as ChatCompletionResponse;
        
        // 错误处理：有时 API 返回 200 但 body 里有 error
        if (data.error) {
            throw new Error(`API Business Error: ${data.error.message}`);
        }

        if (!data.choices || data.choices.length === 0) {
            throw new Error("API returned empty choices.");
        }

        let content = data.choices[0].message.content;
        
        // 清洗 Markdown 标记 (比如 ```python ... ```)
        content = content.replace(/^```python\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
        
        return content.trim();

    } catch (error: any) {
        console.error("[SMELLCC LLM Failure]", error);
        throw new Error(`LLM Call Failed: ${error.message || error}`);
    }
}