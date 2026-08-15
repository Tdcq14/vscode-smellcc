import * as path from 'path';
import * as vscode from 'vscode';
import { ChangeRisk } from './refactorAnalysis';
import { SonarValidationResult, SyntaxValidationResult } from './refactorValidation';

export type HistoryDecision = 'applied' | 'rejected' | 'undone';

export type RefactorHistoryEntry = {
    id: number;
    timestamp: number;
    sourceUri: vscode.Uri;
    line: number;
    smellType: string;
    decision: HistoryDecision;
    risk: ChangeRisk;
    syntax: SyntaxValidationResult;
    validation?: SonarValidationResult;
};

export class RefactorHistoryProvider implements vscode.TreeDataProvider<HistoryTreeItem> {
    private readonly entries: RefactorHistoryEntry[] = [];
    private readonly onDidChangeEmitter = new vscode.EventEmitter<HistoryTreeItem | undefined | void>();
    readonly onDidChangeTreeData = this.onDidChangeEmitter.event;

    constructor(private readonly context: vscode.ExtensionContext) {
        context.subscriptions.push(
            this.onDidChangeEmitter,
            vscode.window.registerTreeDataProvider('smellcc.refactorHistory', this),
            vscode.commands.registerCommand('smellcc.clearHistory', () => this.clear())
        );
    }

    add(entry: RefactorHistoryEntry): void {
        this.entries.unshift(entry);
        if (this.entries.length > 50) {
            this.entries.pop();
        }
        this.onDidChangeEmitter.fire();
    }

    update(id: number, patch: Partial<RefactorHistoryEntry>): void {
        const entry = this.entries.find(item => item.id === id);
        if (!entry) {
            return;
        }
        Object.assign(entry, patch);
        this.onDidChangeEmitter.fire();
    }

    getTreeItem(element: HistoryTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(): HistoryTreeItem[] {
        return this.entries.map(entry => new HistoryTreeItem(entry));
    }

    private clear(): void {
        this.entries.splice(0, this.entries.length);
        this.onDidChangeEmitter.fire();
    }
}

class HistoryTreeItem extends vscode.TreeItem {
    constructor(entry: RefactorHistoryEntry) {
        const fileName = path.basename(entry.sourceUri.fsPath || entry.sourceUri.path);
        super(`${entry.smellType} — ${fileName}`, vscode.TreeItemCollapsibleState.None);

        this.description = `${decisionLabel(entry.decision)} · ${entry.risk.level} risk · +${entry.risk.addedLines}/-${entry.risk.removedLines}`;
        this.iconPath = new vscode.ThemeIcon(iconFor(entry));
        this.tooltip = buildTooltip(entry);
        this.command = {
            command: 'vscode.open',
            title: 'Open refactored file',
            arguments: [entry.sourceUri, { selection: new vscode.Range(entry.line, 0, entry.line, 0) }]
        };
        this.contextValue = 'smellccHistoryEntry';
    }
}

function decisionLabel(decision: HistoryDecision): string {
    if (decision === 'applied') {return 'applied';}
    if (decision === 'undone') {return 'undone';}
    return 'rejected';
}

function iconFor(entry: RefactorHistoryEntry): string {
    if (entry.decision === 'rejected') {return 'circle-slash';}
    if (entry.decision === 'undone') {return 'discard';}
    if (entry.validation?.status === 'failed') {return 'error';}
    if (entry.validation?.status === 'passed') {return 'pass-filled';}
    if (entry.risk.level === 'high') {return 'warning';}
    return 'check';
}

function buildTooltip(entry: RefactorHistoryEntry): vscode.MarkdownString {
    const tooltip = new vscode.MarkdownString(undefined, true);
    tooltip.appendMarkdown(`**${entry.smellType}**\n\n`);
    tooltip.appendMarkdown(`- Decision: ${entry.decision}\n`);
    tooltip.appendMarkdown(`- Risk: ${entry.risk.level}\n`);
    tooltip.appendMarkdown(`- Changed lines: +${entry.risk.addedLines} / -${entry.risk.removedLines}\n`);
    tooltip.appendMarkdown(`- Syntax check: ${entry.syntax.status}\n`);
    if (entry.risk.externalReferenceCount > 0) {
        tooltip.appendMarkdown(`- References outside preview scope: ${entry.risk.externalReferenceCount}\n`);
    }
    if (entry.validation) {
        tooltip.appendMarkdown(`- Sonar validation: ${entry.validation.status}\n`);
        tooltip.appendMarkdown(`- Rule count: ${entry.validation.beforeCount} → ${entry.validation.afterCount}\n`);
    }
    if (entry.risk.reasons.length > 0) {
        tooltip.appendMarkdown(`\n**Risk signals**\n${entry.risk.reasons.map(reason => `- ${reason}`).join('\n')}`);
    }
    return tooltip;
}
