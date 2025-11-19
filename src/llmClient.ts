// src/llmClient.ts
import * as vscode from 'vscode';

interface ChatCompletionResponse {
    choices: {
        message: {
            content: string;
        };
    }[];
}

export async function callLLMApi(prompt: string): Promise<string> {
    // 1. 获取配置
    const config = vscode.workspace.getConfiguration('smellcc');
    const apiKey = config.get<string>('apiKey');
    
    // 默认使用 v3
    const modelName = config.get<string>('model') || "deepseek-v3"; 
    
    // === 关键修改点 ===
    // 必须指向具体的 chat/completions 接口，不能只写 v1
    const apiUrl = "https://api.chatanywhere.tech/v1/chat/completions";

    if (!apiKey || apiKey.trim() === "") {
        const action = "Open Settings";
        const selection = await vscode.window.showErrorMessage(
            "SMELLCC: API Key is missing! Please configure it in settings.",
            action
        );
        if (selection === action) {
            vscode.commands.executeCommand('workbench.action.openSettings', 'smellcc.apiKey');
        }
        throw new Error("API Key missing");
    }

    // 2. 构造请求 (Temperature = 0 是论文关键参数)
    const payload = {
        model: modelName,
        messages: [
            { role: "user", content: prompt }
        ],
        temperature: 0,
        stream: false
    };

    console.log(`[SMELLCC Debug] Sending request to ${apiUrl} with model ${modelName}`);
    
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
            console.error(`[SMELLCC Error] Status: ${response.status}, Body: ${errText}`);
            throw new Error(`API Error (${response.status}): ${errText}`);
        }

        const data = await response.json() as ChatCompletionResponse;
        
        // 检查返回数据结构是否完整
        if (!data.choices || data.choices.length === 0) {
            throw new Error("API returned empty choices.");
        }

        let content = data.choices[0].message.content;

        // 3. 清洗 Markdown 标记
        content = content.replace(/^```python\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
        
        return content.trim();

    } catch (error: any) {
        console.error("[SMELLCC Critical Error]", error);
        throw new Error(`Network Error: ${error.message || error}`);
    }
}