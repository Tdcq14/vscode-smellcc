// src/llmClient.ts
import * as vscode from 'vscode';
import { getMinIndentation, deIndent, reIndent } from './indentUtils';

const fetch = require('node-fetch');

const API_KEY_SECRET = 'smellcc.apiKey';

let secretsStore: vscode.SecretStorage | undefined;

/** 在 activate 时注入 SecretStorage（密钥不再明文存在 settings 里）。 */
export function initSecretStorage(secrets: vscode.SecretStorage): void {
    secretsStore = secrets;
}

/** 优先读 SecretStorage，兼容旧版 settings 明文配置。 */
export async function getApiKey(): Promise<string> {
    if (secretsStore) {
        const stored = await secretsStore.get(API_KEY_SECRET);
        if (stored) {
            return stored;
        }
    }
    const legacy = vscode.workspace.getConfiguration('smellcc').get<string>('apiKey');
    return (legacy ?? '').trim();
}

export async function storeApiKey(key: string): Promise<void> {
    if (!secretsStore) {
        throw new Error('VS Code SecretStorage is not available in this window.');
    }
    await secretsStore.store(API_KEY_SECRET, key.trim());
}

export async function deleteApiKey(): Promise<void> {
    if (secretsStore) {
        await secretsStore.delete(API_KEY_SECRET);
    }
}

/** 一次性迁移：把旧版 settings 里的明文 key 搬进 SecretStorage 并清空旧配置。 */
export async function migrateLegacyApiKey(context: vscode.ExtensionContext): Promise<void> {
    const legacy = (vscode.workspace.getConfiguration('smellcc').get<string>('apiKey') ?? '').trim();
    if (!legacy) {
        return;
    }
    const existing = await context.secrets.get(API_KEY_SECRET);
    if (!existing) {
        await context.secrets.store(API_KEY_SECRET, legacy);
    }
    await vscode.workspace.getConfiguration('smellcc').update('apiKey', undefined, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage('SMELLCC: API key migrated from settings to VS Code SecretStorage.');
}

interface ChatCompletionResponse {
    choices?: {
        message?: {
            content?: string;
        };
        finish_reason?: string | null;
    }[];
    error?: {
        message?: string;
        type?: string;
    } | any;
}

export async function callLLMApi(prompt: string, originalCode: string): Promise<string> {
    const config = vscode.workspace.getConfiguration('smellcc');
    const apiKey = await getApiKey();
    const modelName = config.get<string>('model') || 'deepseek-chat';
    const maxOutputTokens = config.get<number>('maxOutputTokens', 4096);
    const requestTimeoutMs = config.get<number>('requestTimeoutMs', 60000);

    let baseUrl = config.get<string>('apiBaseUrl') || 'https://api.deepseek.com';
    baseUrl = baseUrl.replace(/\/+$/, '');
    const apiUrl = baseUrl.includes('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;

    if (!apiKey) {
        throw new Error('API Key missing — run "SMELLCC: Set API Key" from the Command Palette first.');
    }

    const targetIndent = getMinIndentation(originalCode);
    const payload = {
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.0,
        top_p: 0.1,
        stream: false,
        max_tokens: maxOutputTokens
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1000, requestTimeoutMs));

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`API Error ${response.status}${errorText ? `: ${errorText.slice(0, 300)}` : ''}`);
        }

        const data = await response.json() as ChatCompletionResponse;
        if (data.error) {
            throw new Error(data.error.message || 'LLM provider returned an error payload');
        }

        const choice = data.choices?.[0];
        if (!choice?.message?.content) {
            throw new Error('LLM returned an empty completion');
        }
        if (choice.finish_reason === 'length') {
            throw new Error('LLM output was truncated by the output-token limit; increase Smellcc: Max Output Tokens and retry');
        }

        let content = extractCode(choice.message.content);
        if (!content.trim()) {
            throw new Error('LLM response did not contain usable Python code');
        }

        if (content.includes('class RefactoringContext:')) {
            const lines = content.split('\n');
            const classLineIndex = lines.findIndex(line => line.includes('class RefactoringContext:'));
            if (classLineIndex !== -1) {
                const bodyStr = lines.slice(classLineIndex + 1).join('\n');
                const innerIndent = getMinIndentation(bodyStr);
                content = deIndent(bodyStr, innerIndent > 0 ? innerIndent : 4);
            }
        }

        const llmResultIndent = getMinIndentation(content);
        let finalCode = content;

        if (llmResultIndent === 0 && targetIndent > 0) {
            finalCode = reIndent(content, targetIndent);
        } else if (llmResultIndent > 0) {
            const flatCode = deIndent(content, llmResultIndent);
            finalCode = reIndent(flatCode, targetIndent);
        }

        return finalCode;
    } catch (error: any) {
        console.error('[SMELLCC]', error);
        if (error?.name === 'AbortError') {
            throw new Error(`LLM request timed out after ${requestTimeoutMs} ms`);
        }
        throw new Error(`LLM Failed: ${error.message}`);
    } finally {
        clearTimeout(timeout);
    }
}

function extractCode(rawContent: string): string {
    const trimmed = rawContent.trim();
    const fenced = trimmed.match(/```(?:python|py)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
        return fenced[1].trim();
    }

    return trimmed
        .replace(/^```[a-zA-Z]*\s*/, '')
        .replace(/^```\s*/, '')
        .replace(/```\s*$/, '')
        .trim();
}
