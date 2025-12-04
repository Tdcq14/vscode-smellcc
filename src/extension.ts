// src/extension.ts
import * as vscode from 'vscode';
import { mirrorSonarDiagnostics, mapRuleToPromptType } from './detector';
import { buildSmellCCPrompt } from './promptBuilder';
import { callLLMApi } from './llmClient';

export function activate(context: vscode.ExtensionContext) {
    console.log('SMELLCC Activated!');

    // 1. 依赖检查: 确保安装了 SonarLint
    const sonarExt = vscode.extensions.getExtension('SonarSource.sonarlint-vscode');
    if (!sonarExt) {
        vscode.window.showWarningMessage('SMELLCC needs "SonarLint" extension.', 'Install').then(sel => {
            if (sel === 'Install') vscode.env.openExternal(vscode.Uri.parse('vscode:extension/SonarSource.sonarlint-vscode'));
        });
    }

    const diagnosticCollection = vscode.languages.createDiagnosticCollection('smellcc');
    context.subscriptions.push(diagnosticCollection);

    // 2. 监听诊断变化: 镜像 Sonar 的诊断信息
    const handleDiagnosticsChange = () => {
        if (vscode.window.activeTextEditor) {
            mirrorSonarDiagnostics(vscode.window.activeTextEditor.document, diagnosticCollection);
        }
    };

    context.subscriptions.push(
        vscode.languages.onDidChangeDiagnostics(handleDiagnosticsChange),
        vscode.workspace.onDidOpenTextDocument(handleDiagnosticsChange),
        vscode.workspace.onDidSaveTextDocument(handleDiagnosticsChange)
    );

    // 3. 注册修复提供者 (Code Action)
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('python', new SmellCCActionProvider(), {
            providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
        })
    );

    // 4. 注册重构命令 (核心逻辑修复)
    context.subscriptions.push(
        vscode.commands.registerCommand('smellcc.refactor', async (document: vscode.TextDocument, range: vscode.Range, ruleId: string, message: string) => {
            
            // A. 扩充上下文: 获取包含当前函数的完整代码块
            const expandedRange = expandRangeToFunction(document, range);
            const smellyCode = document.getText(expandedRange);

            // B. 计算相对行号: Sonar 报错行 相对于 扩充后代码块起始行 的偏移量 (从 1 开始)
            const relativeLine = range.start.line - expandedRange.start.line + 1;

            // [CRITICAL FIX] C. 获取报错行的具体代码内容
            // 这是一把“锁”，告诉 LLM “不要随便找个 if 就合并，必须是内容为 xxx 的这一行”
            const targetLineText = document.lineAt(range.start.line).text.trim();

            // D. 将规则 ID (如 python:S1066) 转换为可读 Prompt 类型
            const smellType = mapRuleToPromptType(ruleId);

            console.log(`[SMELLCC] Rule: ${smellType}, RelLine: ${relativeLine}, Target: "${targetLineText}"`);

            // E. 生成 Prompt: 传入 targetLineText 作为第 5 个参数
            const prompt = buildSmellCCPrompt(smellType, smellyCode, message, relativeLine, targetLineText);

            // F. 调用 LLM 并应用编辑
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `SMELLCC: Fixing ${smellType}...`,
                cancellable: false
            }, async () => {
                try {
                    const newCode = await callLLMApi(prompt, smellyCode);
                    
                    const edit = new vscode.WorkspaceEdit();
                    edit.replace(document.uri, expandedRange, newCode);
                    
                    const success = await vscode.workspace.applyEdit(edit);
                    
                    if (success) {
                        vscode.window.showInformationMessage(`SMELLCC: Refactoring for ${smellType} Applied!`);
                        await document.save();
                    } else {
                        vscode.window.showErrorMessage('SMELLCC: Failed to apply edit.');
                    }
                } catch (err: any) {
                    vscode.window.showErrorMessage(`SMELLCC Error: ${err.message}`);
                    console.error(err);
                }
            });
        })
    );
}

// 辅助函数：尝试将选择范围扩充到所在的完整函数定义
function expandRangeToFunction(document: vscode.TextDocument, originalRange: vscode.Range): vscode.Range {
    let startLine = originalRange.start.line;
    let endLine = originalRange.end.line;

    // 1. 向上查找函数定义 (def)
    let foundDef = false;
    let defLineIndex = startLine;
    for (let i = startLine; i >= Math.max(0, startLine - 100); i--) {
        const lineText = document.lineAt(i).text;
        if (/^\s*def\s+/.test(lineText)) {
            defLineIndex = i;
            foundDef = true;
            break;
        }
    }

    if (!foundDef) return document.lineAt(startLine).range;

    // 2. 确定函数缩进级别
    const defLine = document.lineAt(defLineIndex);
    const defIndent = defLine.firstNonWhitespaceCharacterIndex;
    let finalLineIndex = endLine;
    
    // 3. 向下查找函数结束 (通过缩进判断)
    for (let i = defLineIndex + 1; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        if (line.isEmptyOrWhitespace) continue;
        
        if (line.firstNonWhitespaceCharacterIndex <= defIndent) {
            finalLineIndex = i - 1;
            break;
        }
        finalLineIndex = i;
    }

    while (finalLineIndex > defLineIndex && document.lineAt(finalLineIndex).isEmptyOrWhitespace) {
        finalLineIndex--;
    }

    return new vscode.Range(new vscode.Position(defLineIndex, 0), document.lineAt(finalLineIndex).range.end);
}

class SmellCCActionProvider implements vscode.CodeActionProvider {
    provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];
        
        for (const diag of context.diagnostics) {
            if (diag.source === 'SMELLCC') {
                const ruleId = String(diag.code);
                const smellName = mapRuleToPromptType(ruleId);
                const rawMessage = diag.message.replace(/^\[SMELLCC\].*?:\s*/, '');

                const action = new vscode.CodeAction(`Refactor: ${smellName} (SMELLCC)`, vscode.CodeActionKind.QuickFix);
                action.command = {
                    command: 'smellcc.refactor',
                    title: 'Refactor',
                    arguments: [document, diag.range, ruleId, rawMessage]
                };
                action.isPreferred = true;
                actions.push(action);
            }
        }
        return actions;
    }
}

export function deactivate() {}