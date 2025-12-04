// src/llmClient.ts
import * as vscode from 'vscode';
import { getMinIndentation, deIndent, reIndent } from './indentUtils';

const fetch = require('node-fetch');

interface ChatCompletionResponse {
    choices: {
        message: {
            content: string;
        };
    }[];
    error?: any;
}

export async function callLLMApi(prompt: string, originalCode: string): Promise<string> {
    const config = vscode.workspace.getConfiguration('smellcc');
    const apiKey = config.get<string>('apiKey');
    const modelName = config.get<string>('model') || "deepseek-coder";
    
    let baseUrl = config.get<string>('apiBaseUrl') || "https://api.deepseek.com";
    baseUrl = baseUrl.replace(/\/+$/, '');
    let apiUrl = baseUrl.includes('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;

    if (!apiKey) throw new Error("API Key missing");

    const targetIndent = getMinIndentation(originalCode);

    // Params: temperature=0 for deterministic output
    const payload = {
        model: modelName,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.0, 
        top_p: 0.1,
        stream: false,
        max_tokens: 4096
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

        if (!response.ok) throw new Error(`API Error ${response.status}`);
        const data = await response.json() as ChatCompletionResponse;
        
        let content = data.choices[0].message.content;

        // 1. Clean Markdown
        content = content.replace(/^```[a-zA-Z]*\s*/, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

        // 2. Special Cleaning: Strip Class Wrapper
        if (content.includes("class RefactoringContext:")) {
            const lines = content.split('\n');
            const classLineIndex = lines.findIndex(l => l.includes("class RefactoringContext:"));
            if (classLineIndex !== -1) {
                // Take lines after class def
                const bodyLines = lines.slice(classLineIndex + 1);
                const bodyStr = bodyLines.join('\n');
                
                // Remove inner indentation (usually 4 spaces)
                const innerIndent = getMinIndentation(bodyStr);
                content = deIndent(bodyStr, innerIndent > 0 ? innerIndent : 4);
            }
        }

        // 3. Smart Re-indentation (Normalization Logic)
        const llmResultIndent = getMinIndentation(content);
        let finalCode = content;

        if (llmResultIndent === 0 && targetIndent > 0) {
            // LLM returned 0-indexed code -> Add target indent
            finalCode = reIndent(content, targetIndent);
        } else if (llmResultIndent > 0) {
            // LLM returned indented code -> Strip it then add target indent
            const flatCode = deIndent(content, llmResultIndent);
            finalCode = reIndent(flatCode, targetIndent);
        }

        return finalCode;

    } catch (error: any) {
        console.error("[SMELLCC]", error);
        throw new Error(`LLM Failed: ${error.message}`);
    }
}