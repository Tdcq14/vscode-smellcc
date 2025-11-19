// src/extension.ts
import * as vscode from 'vscode';
import { detectSmells, SMELL_TYPES } from './detector'; 
import { buildSmellCCPrompt } from './promptBuilder';
import { callLLMApi } from './llmClient';

export function activate(context: vscode.ExtensionContext) {
    console.log('SMELLCC Extension Activated! (Final Fix)');

    const diagnosticCollection = vscode.languages.createDiagnosticCollection('smellcc');
    context.subscriptions.push(diagnosticCollection);

    const runDetection = (document: vscode.TextDocument) => {
        if (document.languageId === 'python') {
            const diags = detectSmells(document);
            diagnosticCollection.set(document.uri, diags);
        }
    };

    if (vscode.window.activeTextEditor) {
        runDetection(vscode.window.activeTextEditor.document);
    }
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(e => runDetection(e.document)),
        vscode.workspace.onDidOpenTextDocument(runDetection)
    );

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('python', new SmellCCActionProvider(), {
            providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('smellcc.refactor', async (document: vscode.TextDocument, range: vscode.Range, smellType: string) => {
            
            const expandedRange = expandRange(document, range, smellType);
            const smellyCode = document.getText(expandedRange);
            
            const prompt = buildSmellCCPrompt(smellType, smellyCode);

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `SMELLCC: Fixing ${smellType}...`,
                cancellable: false
            }, async () => {
                try {
                    const newCode = await callLLMApi(prompt);

                    const edit = new vscode.WorkspaceEdit();
                    
                    // ⚡️ 修复：Commented Code 逻辑简化
                    // 如果是注释代码且 LLM 返回空，直接用空字符串替换选区
                    if (smellType === SMELL_TYPES.COMMENTED_CODE && newCode.trim().length === 0) {
                         edit.replace(document.uri, expandedRange, ""); 
                    } else {
                         edit.replace(document.uri, expandedRange, newCode);
                    }

                    await vscode.workspace.applyEdit(edit);

                    vscode.window.showInformationMessage('SMELLCC: Refactoring successful!');
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Refactor Failed: ${err.message}`);
                }
            });
        })
    );
}

function expandRange(document: vscode.TextDocument, originalRange: vscode.Range, smellType: string): vscode.Range {
    
    // ⚡️ 修复：Commented Code 范围计算
    // 使用 rangeIncludingLineBreak 确保选中整行（含换行符），这样替换为空字符串时才会真正删除该行
    if (smellType === SMELL_TYPES.COMMENTED_CODE) {
        let startLine = originalRange.start.line;
        let endLine = originalRange.end.line;

        // 向上找
        while (startLine > 0) {
            const prevLine = document.lineAt(startLine - 1);
            if (prevLine.text.trim().startsWith('#')) {
                startLine--;
            } else {
                break;
            }
        }
        // 向下找
        while (endLine < document.lineCount - 1) {
            const nextLine = document.lineAt(endLine + 1);
            if (nextLine.text.trim().startsWith('#')) {
                endLine++;
            } else {
                break;
            }
        }
        
        // 构造包含换行符的完整范围
        const start = document.lineAt(startLine).rangeIncludingLineBreak.start;
        // 注意：endLine 这一行的 rangeIncludingLineBreak.end 包含了它后面的换行符
        const end = document.lineAt(endLine).rangeIncludingLineBreak.end;
        
        return new vscode.Range(start, end);
    }

    // 结构性异味 (保持全函数逻辑)
    const structuralSmells = [
        SMELL_TYPES.LONG_PARAM,         
        SMELL_TYPES.NAMING,             
        SMELL_TYPES.HIGH_COMPLEXITY,    
        SMELL_TYPES.RETURN_YIELD,       
        SMELL_TYPES.EMPTY_NESTED,       
        SMELL_TYPES.SELF_ASSIGN,        
        SMELL_TYPES.DEAD_CODE,          
        SMELL_TYPES.IDENTICAL_EXPR,
        SMELL_TYPES.COLLAPSIBLE_IF      
    ];

    if (structuralSmells.includes(smellType)) {
        const startLine = originalRange.start.line;
        let defLine = startLine;
        let foundDef = false;
        
        const MAX_LOOKUP = 50;
        for (let i = 0; i < MAX_LOOKUP; i++) {
            if (defLine < 0) break;
            const lineText = document.lineAt(defLine).text;
            if (lineText.trim().startsWith('def ')) {
                foundDef = true;
                break;
            }
            defLine--;
        }

        if (!foundDef) {
            return document.lineAt(originalRange.start.line).rangeIncludingLineBreak;
        }

        const defLineText = document.lineAt(defLine).text;
        const matchDefIndent = defLineText.match(/^(\s*)/);
        const baseIndent = matchDefIndent ? matchDefIndent[1].length : 0;
        
        let endLine = defLine;
        for (let i = defLine + 1; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            if (line.isEmptyOrWhitespace) continue;
            
            const currentIndent = line.text.match(/^\s*/)?.[0].length || 0;
            if (currentIndent <= baseIndent) {
                if (!line.text.trim().startsWith('#')) break;
            }
            endLine = i;
        }
        
        return new vscode.Range(new vscode.Position(defLine, 0), document.lineAt(endLine).range.end);
    }

    return document.lineAt(originalRange.start.line).rangeIncludingLineBreak;
}

class SmellCCActionProvider implements vscode.CodeActionProvider {
    provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext): vscode.CodeAction[] {
        return context.diagnostics
            .filter(d => d.source === 'SMELLCC')
            .map(diag => {
                const action = new vscode.CodeAction(`Fix '${diag.code}' with SMELLCC`, vscode.CodeActionKind.QuickFix);
                action.command = {
                    command: 'smellcc.refactor',
                    title: 'Refactor',
                    arguments: [document, diag.range, diag.code]
                };
                return action;
            });
    }
}

export function deactivate() {}