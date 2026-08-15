// src/extension.ts
import * as vscode from 'vscode';
import { mirrorSonarDiagnostics, mapRuleToPromptType, SMELL_TYPES } from './detector';
import { buildSmellCCPrompt } from './promptBuilder';
import { callLLMApi, deleteApiKey, getApiKey, initSecretStorage, migrateLegacyApiKey, storeApiKey } from './llmClient';
import { RefactorHistoryProvider } from './refactorHistory';
import { RefactorPreviewManager } from './refactorPreview';

export function activate(context: vscode.ExtensionContext) {
    console.log('SMELLCC Activated!');

    initSecretStorage(context.secrets);
    migrateLegacyApiKey(context).catch(err => console.warn('[SMELLCC] API key migration skipped:', err));

    const sonarExt = vscode.extensions.getExtension('SonarSource.sonarlint-vscode');
    if (!sonarExt) {
        vscode.window.showWarningMessage('SMELLCC needs "SonarLint" extension.', 'Install').then(sel => {
            if (sel === 'Install') {vscode.env.openExternal(vscode.Uri.parse('vscode:extension/SonarSource.sonarlint-vscode'));}
        });
    }

    const diagnosticCollection = vscode.languages.createDiagnosticCollection('smellcc');
    context.subscriptions.push(diagnosticCollection);

    const syncDiagnostics = (document?: vscode.TextDocument) => {
        const targets = document ? [document] : vscode.workspace.textDocuments;
        for (const doc of targets) {
            if (doc.languageId === 'python') {
                mirrorSonarDiagnostics(doc, diagnosticCollection);
            }
        }
    };

    // Apply 之后旧镜像诊断不可信：先清掉，等 Sonar 异步重扫完再同步回来
    const clearAndResyncDiagnostics = (uri: vscode.Uri) => {
        diagnosticCollection.delete(uri);
        for (const delay of [800, 2500]) {
            setTimeout(() => {
                const doc = vscode.workspace.textDocuments.find(open => open.uri.toString() === uri.toString());
                if (doc) {
                    syncDiagnostics(doc);
                }
            }, delay);
        }
    };

    const historyProvider = new RefactorHistoryProvider(context);
    const previewManager = new RefactorPreviewManager(context, historyProvider, clearAndResyncDiagnostics);

    context.subscriptions.push(
        vscode.languages.onDidChangeDiagnostics(event => {
            for (const uri of event.uris) {
                const changedDoc = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
                if (changedDoc) {
                    syncDiagnostics(changedDoc);
                }
            }
            // 兜底：语言服务器可能刷新了未出现在 event.uris 里的文档
            syncDiagnostics();
        }),
        vscode.workspace.onDidOpenTextDocument(doc => syncDiagnostics(doc)),
        vscode.workspace.onDidSaveTextDocument(doc => syncDiagnostics(doc)),
        vscode.window.onDidChangeActiveTextEditor(editor => syncDiagnostics(editor?.document))
    );

    // 关键修复：激活时立即同步“已经存在”的 Sonar 诊断。
    // Sonar 语言服务器是异步启动的，激活瞬间可能还没产出诊断，
    // 所以再按 500ms / 1.5s / 4s 重试几次，避免错过初始事件。
    syncDiagnostics();
    const retryTimers = [500, 1500, 4000].map(delay => setTimeout(() => syncDiagnostics(), delay));
    context.subscriptions.push({ dispose: () => retryTimers.forEach(timer => clearTimeout(timer)) });

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('python', new SmellCCActionProvider(), {
            providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('smellcc.setApiKey', async () => {
            const key = await vscode.window.showInputBox({
                title: 'SMELLCC: Set DeepSeek API Key',
                prompt: 'Paste your API key (stored securely in VS Code SecretStorage). Get one at https://platform.deepseek.com',
                placeHolder: 'sk-...',
                password: true,
                ignoreFocusOut: true
            });
            if (key === undefined) {
                return;
            }
            const trimmed = key.trim();
            if (!trimmed) {
                vscode.window.showErrorMessage('SMELLCC: API key cannot be empty.');
                return;
            }
            try {
                await storeApiKey(trimmed);
                vscode.window.showInformationMessage('SMELLCC: API key stored securely in VS Code SecretStorage.');
            } catch (err: any) {
                vscode.window.showErrorMessage(`SMELLCC: ${err.message}`);
            }
        }),
        vscode.commands.registerCommand('smellcc.clearApiKey', async () => {
            const choice = await vscode.window.showWarningMessage(
                'SMELLCC: Remove the stored API key from SecretStorage?',
                'Remove',
                'Cancel'
            );
            if (choice === 'Remove') {
                await deleteApiKey();
                vscode.window.showInformationMessage('SMELLCC: API key removed.');
            }
        }),
        vscode.commands.registerCommand('smellcc.undoRefactorEntry', (item: unknown) => {
            const entryId = typeof item === 'number'
                ? item
                : (item as { entryId?: number } | undefined)?.entryId;
            if (typeof entryId === 'number') {
                previewManager.undoById(entryId);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('smellcc.refactor', async (document: vscode.TextDocument, range: vscode.Range, ruleId: string, message: string) => {
            if (!(await ensureApiKey())) {
                return;
            }
            const expandedRange = await expandRangeToFunction(document, range);
            const smellyCode = document.getText(expandedRange);
            const relativeLine = range.start.line - expandedRange.start.line + 1;
            const targetLineText = document.lineAt(range.start.line).text.trim();
            const smellType = mapRuleToPromptType(ruleId);

            console.log(`[SMELLCC] Rule: ${smellType}, RelLine: ${relativeLine}, Target: "${targetLineText}"`);

            const externalReferenceCount = await countExternalReferences(document, range, expandedRange, smellType);
            const prompt = buildSmellCCPrompt(smellType, smellyCode, message, relativeLine, targetLineText);

            try {
                const newCode = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `SMELLCC: Generating ${smellType} refactor...`,
                    cancellable: false
                }, () => callLLMApi(prompt, smellyCode));

                await previewManager.previewAndApply(document, expandedRange, newCode, {
                    smellType,
                    ruleId,
                    externalReferenceCount
                });
            } catch (err: any) {
                vscode.window.showErrorMessage(`SMELLCC Error: ${err.message}`);
                console.error(err);
            }
        })
    );
}

async function ensureApiKey(): Promise<boolean> {
    if (await getApiKey()) {
        return true;
    }
    const key = await vscode.window.showInputBox({
        title: 'SMELLCC: DeepSeek API Key Required',
        prompt: 'Enter your API key (stored in VS Code SecretStorage, not in plaintext settings). Get one at https://platform.deepseek.com',
        placeHolder: 'sk-...',
        password: true,
        ignoreFocusOut: true
    });
    if (key === undefined) {
        return false;
    }
    const trimmed = key.trim();
    if (!trimmed) {
        vscode.window.showErrorMessage('SMELLCC: API key cannot be empty.');
        return false;
    }
    try {
        await storeApiKey(trimmed);
        vscode.window.showInformationMessage('SMELLCC: API key stored securely. Generating refactor...');
        return true;
    } catch (err: any) {
        vscode.window.showErrorMessage(`SMELLCC: ${err.message}`);
        return false;
    }
}

async function countExternalReferences(
    document: vscode.TextDocument,
    diagnosticRange: vscode.Range,
    previewScope: vscode.Range,
    smellType: string
): Promise<number> {
    const workspaceImpactSmells = new Set<string>([
        SMELL_TYPES.NAMING_CLASS,
        SMELL_TYPES.NAMING_FUNC,
        SMELL_TYPES.NAMING_METHOD,
        SMELL_TYPES.NAMING_FIELD,
        SMELL_TYPES.LONG_PARAM
    ]);

    if (!workspaceImpactSmells.has(smellType)) {
        return 0;
    }

    try {
        const references = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeReferenceProvider',
            document.uri,
            diagnosticRange.start
        );

        if (!references) {
            return 0;
        }

        return references.filter(location => {
            const sameDocument = location.uri.toString() === document.uri.toString();
            return !sameDocument || !containsRange(previewScope, location.range);
        }).length;
    } catch (err) {
        console.warn('[SMELLCC] Reference lookup failed; continuing without workspace impact data.', err);
        return 0;
    }
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
    const startLine = originalRange.start.line;
    const endLine = originalRange.end.line;
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

    if (!foundDef) {return document.lineAt(startLine).range;}

    const defLine = document.lineAt(defLineIndex);
    const defIndent = defLine.firstNonWhitespaceCharacterIndex;
    let finalLineIndex = endLine;

    for (let i = defLineIndex + 1; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        if (line.isEmptyOrWhitespace) {continue;}

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
