import * as path from 'path';
import * as vscode from 'vscode';
import { analyzeChangeRisk, ChangeRisk } from './refactorAnalysis';
import { RefactorHistoryProvider } from './refactorHistory';
import {
    captureSonarBaseline,
    SonarBaseline,
    SyntaxValidationResult,
    validatePythonSyntax,
    waitForSonarValidation
} from './refactorValidation';

type RefactorMetadata = {
    smellType: string;
    ruleId: string;
    externalReferenceCount: number;
};

type PreviewSnapshot = {
    sourceUri: vscode.Uri;
    range: vscode.Range;
    startOffset: number;
    before: string;
    after: string;
    metadata: RefactorMetadata;
    risk: ChangeRisk;
    syntax: SyntaxValidationResult;
    sonarBaseline: SonarBaseline;
    historyId: number;
};

type AppliedSnapshot = PreviewSnapshot & {
    appliedRange: vscode.Range;
};

export class RefactorPreviewManager implements vscode.TextDocumentContentProvider {
    private readonly documents = new Map<string, string>();
    private readonly undoStack: AppliedSnapshot[] = [];
    private nextPreviewId = 1;
    private nextHistoryId = 1;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly history: RefactorHistoryProvider
    ) {
        context.subscriptions.push(
            vscode.workspace.registerTextDocumentContentProvider('smellcc-preview', this),
            vscode.commands.registerCommand('smellcc.undoLastRefactor', () => this.undoLastRefactor())
        );
    }

    provideTextDocumentContent(uri: vscode.Uri): string {
        return this.documents.get(uri.toString()) ?? '';
    }

    async previewAndApply(
        document: vscode.TextDocument,
        range: vscode.Range,
        newCode: string,
        metadata: RefactorMetadata
    ): Promise<boolean> {
        const originalDocumentText = document.getText();
        const startOffset = document.offsetAt(range.start);
        const endOffset = document.offsetAt(range.end);
        const before = originalDocumentText.slice(startOffset, endOffset);
        const proposedDocumentText =
            originalDocumentText.slice(0, startOffset) + newCode + originalDocumentText.slice(endOffset);

        if (before === newCode) {
            vscode.window.showInformationMessage(`SMELLCC: ${metadata.smellType} produced no textual changes.`);
            return false;
        }

        const risk = analyzeChangeRisk(before, newCode, metadata.smellType, metadata.externalReferenceCount);
        const syntax = await validatePythonSyntax(proposedDocumentText);
        const historyId = this.nextHistoryId++;
        const sonarBaseline = captureSonarBaseline(document.uri, metadata.ruleId, range);

        const previewId = this.nextPreviewId++;
        const fileName = path.basename(document.fileName || document.uri.path || 'refactor.py');
        const originalUri = this.makePreviewUri(previewId, 'before', fileName);
        const proposedUri = this.makePreviewUri(previewId, 'after', fileName);

        this.documents.set(originalUri.toString(), originalDocumentText);
        this.documents.set(proposedUri.toString(), proposedDocumentText);
        this.prunePreviewDocuments();

        await vscode.commands.executeCommand(
            'vscode.diff',
            originalUri,
            proposedUri,
            `SMELLCC Review: ${metadata.smellType} — ${fileName}`,
            { preview: false }
        );

        const decision = await this.requestDecision(metadata.smellType, risk, syntax);
        const applyLabel = risk.level === 'high' ? 'Apply High-Risk Refactor' : 'Apply Refactor';

        if (decision !== applyLabel) {
            this.history.add({
                id: historyId,
                timestamp: Date.now(),
                sourceUri: document.uri,
                line: range.start.line,
                smellType: metadata.smellType,
                decision: 'rejected',
                risk,
                syntax
            });
            if (decision === 'Reject') {
                vscode.window.showInformationMessage('SMELLCC: Refactor rejected. No source code was changed.');
            }
            return false;
        }

        return this.applySnapshot({
            sourceUri: document.uri,
            range,
            startOffset,
            before,
            after: newCode,
            metadata,
            risk,
            syntax,
            sonarBaseline,
            historyId
        });
    }

    private async requestDecision(
        smellType: string,
        risk: ChangeRisk,
        syntax: SyntaxValidationResult
    ): Promise<string | undefined> {
        const changeSummary = `+${risk.addedLines}/-${risk.removedLines}, ${risk.level} risk`;

        if (syntax.status === 'failed') {
            await vscode.window.showErrorMessage(
                `SMELLCC proposal has invalid Python syntax and was blocked before Apply. ${syntax.detail}`
            );
            return 'Reject';
        }

        if (risk.level === 'high') {
            const reasons = risk.reasons.length > 0 ? ` ${risk.reasons.join('; ')}.` : '';
            return vscode.window.showWarningMessage(
                `SMELLCC generated a high-risk ${smellType} proposal (${changeSummary}).${reasons} Review the diff carefully.`,
                { modal: true },
                'Apply High-Risk Refactor',
                'Reject'
            );
        }

        const syntaxNote = syntax.status === 'passed'
            ? 'Python syntax check passed.'
            : 'Python syntax check unavailable; inspect the diff before applying.';

        return vscode.window.showInformationMessage(
            `SMELLCC generated a ${smellType} refactor (${changeSummary}). ${syntaxNote}`,
            'Apply Refactor',
            'Reject'
        );
    }

    private async applySnapshot(snapshot: PreviewSnapshot): Promise<boolean> {
        const currentDocument = await vscode.workspace.openTextDocument(snapshot.sourceUri);
        const currentText = currentDocument.getText(snapshot.range);

        if (currentText !== snapshot.before) {
            vscode.window.showWarningMessage(
                'SMELLCC: The source changed while the diff was being reviewed. Refactor was not applied; please run it again.'
            );
            return false;
        }

        const edit = new vscode.WorkspaceEdit();
        edit.replace(snapshot.sourceUri, snapshot.range, snapshot.after);
        const success = await vscode.workspace.applyEdit(edit);

        if (!success) {
            vscode.window.showErrorMessage('SMELLCC: Failed to apply refactor.');
            return false;
        }

        const updatedDocument = await vscode.workspace.openTextDocument(snapshot.sourceUri);
        const appliedEnd = updatedDocument.positionAt(snapshot.startOffset + snapshot.after.length);
        const appliedSnapshot: AppliedSnapshot = {
            ...snapshot,
            appliedRange: new vscode.Range(snapshot.range.start, appliedEnd)
        };
        this.undoStack.push(appliedSnapshot);
        if (this.undoStack.length > 20) {
            this.undoStack.shift();
        }

        this.history.add({
            id: snapshot.historyId,
            timestamp: Date.now(),
            sourceUri: snapshot.sourceUri,
            line: snapshot.range.start.line,
            smellType: snapshot.metadata.smellType,
            decision: 'applied',
            risk: snapshot.risk,
            syntax: snapshot.syntax
        });

        const autoSave = vscode.workspace.getConfiguration('smellcc').get<boolean>('autoSaveAfterApply', false);
        if (autoSave) {
            await updatedDocument.save();
        }

        const validationEnabled = vscode.workspace.getConfiguration('smellcc').get<boolean>('validateAfterApply', true);
        if (!validationEnabled) {
            await this.showAppliedMessage(appliedSnapshot, 'SMELLCC: Refactor applied. Post-apply Sonar validation is disabled.');
            return true;
        }

        const timeoutMs = vscode.workspace.getConfiguration('smellcc').get<number>('validationTimeoutMs', 5000);
        const validation = await waitForSonarValidation(
            snapshot.sourceUri,
            snapshot.metadata.ruleId,
            appliedSnapshot.appliedRange,
            snapshot.sonarBaseline,
            timeoutMs
        );
        this.history.update(snapshot.historyId, { validation });

        if (validation.status === 'passed') {
            await this.showAppliedMessage(
                appliedSnapshot,
                `SMELLCC: ${snapshot.metadata.smellType} refactor validated — target Sonar rule count ${validation.beforeCount} → ${validation.afterCount}.`
            );
        } else if (validation.status === 'failed') {
            const choice = await vscode.window.showWarningMessage(
                `SMELLCC: Refactor was applied, but validation failed: ${validation.detail}`,
                { modal: true },
                'Undo SMELLCC Refactor',
                'Keep Anyway'
            );
            if (choice === 'Undo SMELLCC Refactor') {
                await this.undoLastRefactor();
            }
        } else {
            await this.showAppliedMessage(
                appliedSnapshot,
                `SMELLCC: Refactor applied, but validation is inconclusive: ${validation.detail}`
            );
        }

        return true;
    }

    private async showAppliedMessage(snapshot: AppliedSnapshot, message: string): Promise<void> {
        const undoNow = await vscode.window.showInformationMessage(message, 'Undo SMELLCC Refactor');
        if (undoNow === 'Undo SMELLCC Refactor') {
            await this.undoLastRefactor(snapshot.historyId);
        }
    }

    async undoLastRefactor(expectedHistoryId?: number): Promise<void> {
        const snapshot = this.undoStack[this.undoStack.length - 1];
        if (!snapshot) {
            vscode.window.showInformationMessage('SMELLCC: There is no refactor to undo.');
            return;
        }

        if (expectedHistoryId !== undefined && snapshot.historyId !== expectedHistoryId) {
            vscode.window.showWarningMessage('SMELLCC: A newer refactor exists, so this older change cannot be undone out of order.');
            return;
        }

        const currentDocument = await vscode.workspace.openTextDocument(snapshot.sourceUri);
        const currentText = currentDocument.getText(snapshot.appliedRange);

        if (currentText !== snapshot.after) {
            vscode.window.showWarningMessage(
                'SMELLCC: The refactored code has changed since it was applied, so safe undo was cancelled to avoid overwriting your edits.'
            );
            return;
        }

        const edit = new vscode.WorkspaceEdit();
        edit.replace(snapshot.sourceUri, snapshot.appliedRange, snapshot.before);
        const success = await vscode.workspace.applyEdit(edit);

        if (success) {
            this.undoStack.pop();
            this.history.update(snapshot.historyId, { decision: 'undone' });
            vscode.window.showInformationMessage('SMELLCC: Last refactor undone.');
        } else {
            vscode.window.showErrorMessage('SMELLCC: Failed to undo the last refactor.');
        }
    }

    private makePreviewUri(id: number, side: 'before' | 'after', fileName: string): vscode.Uri {
        return vscode.Uri.from({
            scheme: 'smellcc-preview',
            path: `/${id}/${side}/${fileName}`
        });
    }

    private prunePreviewDocuments(): void {
        const maxEntries = 20;
        while (this.documents.size > maxEntries) {
            const firstKey = this.documents.keys().next().value as string | undefined;
            if (!firstKey) {
                break;
            }
            this.documents.delete(firstKey);
        }
    }
}
