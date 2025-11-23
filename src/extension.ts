// src/extension.ts
import * as vscode from 'vscode';
import { mirrorSonarDiagnostics, mapRuleToPromptType } from './detector';
import { buildSmellCCPrompt } from './promptBuilder';
import { callLLMApi } from './llmClient';

export function activate(context: vscode.ExtensionContext) {
    console.log('SMELLCC Activated!');

    // 依赖检查
    const sonarExt = vscode.extensions.getExtension('SonarSource.sonarlint-vscode');
    if (!sonarExt) {
        vscode.window.showWarningMessage('SMELLCC needs "SonarLint".', 'Install').then(sel => {
            if (sel === 'Install') vscode.env.openExternal(vscode.Uri.parse('vscode:extension/SonarSource.sonarlint-vscode'));
        });
    }

    const diagnosticCollection = vscode.languages.createDiagnosticCollection('smellcc');
    context.subscriptions.push(diagnosticCollection);

    // 监听诊断变化
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

    // 注册修复提供者
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('python', new SmellCCActionProvider(), {
            providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
        })
    );

    // 注册重构命令
    context.subscriptions.push(
        vscode.commands.registerCommand('smellcc.refactor', async (document: vscode.TextDocument, range: vscode.Range, ruleId: string) => {
            
            // === ⚡️ 核心升级：智能扩充上下文 ⚡️ ===
            // 无论报错在哪里，都尝试获取整个包裹它的函数
            const expandedRange = expandRangeToFunction(document, range);
            const smellyCode = document.getText(expandedRange);

            console.log(`[SMELLCC] Context Code:\n${smellyCode}`); // 调试日志

            const prompt = buildSmellCCPrompt(ruleId, smellyCode);

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `SMELLCC: Fixing...`,
                cancellable: false
            }, async () => {
                try {
                    const newCode = await callLLMApi(prompt);
                    
                    const edit = new vscode.WorkspaceEdit();
                    // 替换扩充后的整个范围（通常是整个函数）
                    edit.replace(document.uri, expandedRange, newCode);
                    
                    const success = await vscode.workspace.applyEdit(edit);
                    
                    if (success) {
                        vscode.window.showInformationMessage('SMELLCC: Refactoring Applied!');
                        await document.save(); // 自动保存以触发重新检测
                    } else {
                        vscode.window.showErrorMessage('SMELLCC: Failed to apply edit.');
                    }
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Error: ${err.message}`);
                }
            });
        })
    );
}

// === 辅助函数：向外寻找最近的函数定义 ===
// 逻辑：向上找 'def'，向下找缩进结束
function expandRangeToFunction(document: vscode.TextDocument, originalRange: vscode.Range): vscode.Range {
    let startLine = originalRange.start.line;
    let endLine = originalRange.end.line;

    // 1. 向上找 'def ' (假设 Python)
    let foundDef = false;
    let defLineIndex = startLine;
    
    // 限制向上找 100 行
    for (let i = startLine; i >= Math.max(0, startLine - 100); i--) {
        const lineText = document.lineAt(i).text;
        // 匹配 def 开头 (忽略前面的空格)
        if (/^\s*def\s+/.test(lineText)) {
            defLineIndex = i;
            foundDef = true;
            break;
        }
    }

    // 如果没找到函数定义（比如是全局变量），就只处理当前行
    if (!foundDef) {
        return document.lineAt(startLine).range; 
    }

    // 2. 向下找函数结束 (通过缩进判断)
    const defLine = document.lineAt(defLineIndex);
    const defIndent = defLine.firstNonWhitespaceCharacterIndex;
    
    let finalLineIndex = endLine;
    
    // 从 def 的下一行开始找
    for (let i = defLineIndex + 1; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        
        // 跳过空行，空行属于函数的一部分
        if (line.isEmptyOrWhitespace) continue; 

        const currentIndent = line.firstNonWhitespaceCharacterIndex;
        
        // 如果当前行缩进 <= def 的缩进，说明函数结束了（遇到了下一个同级或上级语句）
        if (currentIndent <= defIndent) {
            finalLineIndex = i - 1;
            break;
        }
        finalLineIndex = i;
    }

    // 修正边界：如果最后几行是空行，去掉它们
    while (finalLineIndex > defLineIndex && document.lineAt(finalLineIndex).isEmptyOrWhitespace) {
        finalLineIndex--;
    }

    // 返回整个函数的 Range
    return new vscode.Range(
        new vscode.Position(defLineIndex, 0), 
        document.lineAt(finalLineIndex).range.end
    );
}

class SmellCCActionProvider implements vscode.CodeActionProvider {
    provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        for (const diag of context.diagnostics) {
            // 必须匹配 SMELLCC 的源
            if (diag.source === 'SMELLCC') {
                // diag.code 存的是 Rule ID (如 python:S101)
                const ruleId = String(diag.code);
                const smellName = mapRuleToPromptType(ruleId);

                const action = new vscode.CodeAction(`Refactor: ${smellName} (SMELLCC)`, vscode.CodeActionKind.QuickFix);
                action.command = {
                    command: 'smellcc.refactor',
                    title: 'Refactor',
                    arguments: [document, diag.range, ruleId] // 传入原始 Range，让命令去扩充
                };
                action.isPreferred = true;
                actions.push(action);
            }
        }
        return actions;
    }
}

export function deactivate() {}