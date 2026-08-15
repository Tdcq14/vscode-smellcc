// src/extension.ts
import * as vscode from 'vscode';
import { mirrorSonarDiagnostics, mapRuleToPromptType } from './detector';
import { buildSmellCCPrompt } from './promptBuilder';
import { callLLMApi } from './llmClient';
import { RefactorPreviewManager } from './refactorPreview';

export function activate(context: vscode.ExtensionContext) {
    console.log('SMELLCC Activated!');

    const sonarExt = vscode.extensions.getExtension('SonarSource.sonarlint-vscode');
    if (!sonarExt) {
        vscode.window.showWarningMessage('SMELLCC needs "SonarLint" extension.', 'Install').then(sel => {
            if (sel === 'Install') vscode.env.openExternal(vscode.Uri.parse('vscode:extension/SonarSource.sonarlint-vscode'));
        });
    }

    const diagnosticCollection = vscode.languages.createDiagnosticCollection('smellcc');
    context.subscriptions.push(diagnosticCollection);

    const previewManager = new RefactorPreviewManager(context);

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

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('python', new SmellCCActionProvider(), {
            providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('smellcc.refactor', async (document: vscode.TextDocument, range: vscode.Range, ruleId: string, message: string) => {
            const expandedRange = await expandRangeToFunction(document, range);
            const smellyCode = document.getText(expandedRange);
            const relativeLine = range.start.line - expandedRange.start.line + 1;
            const targetLineText = document.lineAt(range.start.line).text.trim();
            const smellType = mapRuleToPromptType(ruleId);

            console.log(`[SMELLCC] Rule: ${smellType}, RelLine: ${relativeLine}, Target: "${targetLineText}"`);

            const prompt = buildSmellCCPrompt(smellType, smellyCode, message, relativeLine, targetLineText);

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `SMELLCC: Generating ${smellType} refactor...`,
                cancellable: false
            }, async () => {
                try {
                    const newCode = await callLLMApi(prompt, smellyCode);
                    const applied = await previewManager.previewAndApply(document, expandedRange, newCode, smellType);

                    if (applied) {
                        const autoSave = vscode.workspace.getConfiguration('smellcc').get<boolean>('autoSaveAfterApply', false);
                        if (autoSave) {
                            const updatedDocument = await vscode.workspace.openTextDocument(document.uri);
                            await updatedDocument.save();
                        }
                    }
                } catch (err: any) {
                    vscode.window.showErrorMessage(`SMELLCC Error: ${err.message}`);
                    console.error(err);
                }
            });
        })
    );
}

async function expandRangeToFunction(document: vscode.TextDocument, originalRange: vscode.Range): Promise<vscode.Range> {
    try {
        const symbols = await vscode.commands.executeCommand<Array<vscode.DocumentSymbol | vscode.SymbolInformation>>(
            'vscode.executeDocumentSymbolProvider',
            document.uri
        );

        const candidates: vscode.Range[] = [];
        collectContainingFunctionRanges(symbols ?? [], originalRange, candidates);

        if (candidates.length > 0) {
            candidates.sort((a, b) => rangeSize(a) - rangeSize(b));
            return candidates[0];
        }
    } catch (err) {
        console.warn('[SMELLCC] Document symbol lookup failed; falling back to indentation scan.', err);
    }

    return expandRangeByIndentation(document, originalRange);
}

function collectContainingFunctionRanges(
    symbols: readonly (vscode.DocumentSymbol | vscode.SymbolInformation)[],
    targetRange: vscode.Range,
    output: vscode.Range[]
): void {
    for (const symbol of symbols) {
        const symbolRange = 'location' in symbol ? symbol.location.range : symbol.range;
        if (
            (symbol.kind === vscode.SymbolKind.Function || symbol.kind === vscode.SymbolKind.Method) &&
            containsRange(symbolRange, targetRange)
        ) {
            output.push(symbolRange);
        }
        if ('children' in symbol) {
            collectContainingFunctionRanges(symbol.children, targetRange, output);
        }
    }
}

function containsRange(outer: vscode.Range, inner: vscode.Range): boolean {
    return outer.start.isBeforeOrEqual(inner.start) && outer.end.isAfterOrEqual(inner.end);
}

function rangeSize(range: vscode.Range): number {
    const lineSpan = range.end.line - range.start.line;
    return lineSpan * 1_000_000 + (range.end.character - range.start.character);
}

function expandRangeByIndentation(document: vscode.TextDocument, originalRange: vscode.Range): vscode.Range {
    let startLine = originalRange.start.line;
    let endLine = originalRange.end.line;
    let foundDef = false;
    let defLineIndex = startLine;

    for (let i = startLine; i >= Math.max(0, startLine - 100); i--) {
        const lineText = document.lineAt(i).text;
        if (/^\s*(async\s+)?def\s+/.test(lineText)) {
            defLineIndex = i;
            foundDef = true;
            break;
        }
    }

    if (!foundDef) return document.lineAt(startLine).range;

    const defLine = document.lineAt(defLineIndex);
    const defIndent = defLine.firstNonWhitespaceCharacterIndex;
    let finalLineIndex = endLine;

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
