import * as path from 'path';
import * as vscode from 'vscode';

type PreviewSnapshot = {
    sourceUri: vscode.Uri;
    range: vscode.Range;
    startOffset: number;
    before: string;
    after: string;
    smellType: string;
};

type AppliedSnapshot = PreviewSnapshot & {
    appliedRange: vscode.Range;
};

export class RefactorPreviewManager implements vscode.TextDocumentContentProvider {
    private readonly documents = new Map<string, string>();
    private readonly history: AppliedSnapshot[] = [];
    private nextId = 1;

    constructor(private readonly context: vscode.ExtensionContext) {
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
        smellType: string
    ): Promise<boolean> {
        const originalDocumentText = document.getText();
        const startOffset = document.offsetAt(range.start);
        const endOffset = document.offsetAt(range.end);
        const before = originalDocumentText.slice(startOffset, endOffset);
        const proposedDocumentText =
            originalDocumentText.slice(0, startOffset) + newCode + originalDocumentText.slice(endOffset);

        if (before === newCode) {
            vscode.window.showInformationMessage(`SMELLCC: ${smellType} produced no textual changes.`);
            return false;
        }

        const id = this.nextId++;
        const fileName = path.basename(document.fileName || document.uri.path || 'refactor.py');
        const originalUri = this.makePreviewUri(id, 'before', fileName);
        const proposedUri = this.makePreviewUri(id, 'after', fileName);

        this.documents.set(originalUri.toString(), originalDocumentText);
        this.documents.set(proposedUri.toString(), proposedDocumentText);
        this.prunePreviewDocuments();

        await vscode.commands.executeCommand(
            'vscode.diff',
            originalUri,
            proposedUri,
            `SMELLCC Review: ${smellType} — ${fileName}`,
            { preview: false }
        );

        const decision = await vscode.window.showInformationMessage(
            `SMELLCC generated a ${smellType} refactor. Review the highlighted diff, then apply or reject it.`,
            'Apply Refactor',
            'Reject'
        );

        if (decision !== 'Apply Refactor') {
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
            smellType
        });
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
        this.history.push({
            ...snapshot,
            appliedRange: new vscode.Range(snapshot.range.start, appliedEnd)
        });
        if (this.history.length > 20) {
            this.history.shift();
        }

        const undoNow = await vscode.window.showInformationMessage(
            `SMELLCC: ${snapshot.smellType} refactor applied.`,
            'Undo SMELLCC Refactor'
        );
        if (undoNow === 'Undo SMELLCC Refactor') {
            await this.undoLastRefactor();
        }

        return true;
    }

    async undoLastRefactor(): Promise<void> {
        const snapshot = this.history[this.history.length - 1];
        if (!snapshot) {
            vscode.window.showInformationMessage('SMELLCC: There is no refactor to undo.');
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
            this.history.pop();
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
