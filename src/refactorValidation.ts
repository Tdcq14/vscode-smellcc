import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';

const execFileAsync = promisify(execFile);

export type SyntaxValidationResult = {
    status: 'passed' | 'failed' | 'unavailable';
    detail: string;
};

export type SonarValidationResult = {
    status: 'passed' | 'failed' | 'inconclusive';
    beforeCount: number;
    afterCount: number;
    detail: string;
};

export type SonarBaseline = {
    count: number;
    fingerprint: string;
};

export async function validatePythonSyntax(documentText: string): Promise<SyntaxValidationResult> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smellcc-'));
    const tempFile = path.join(tempDir, 'proposal.py');

    try {
        await fs.writeFile(tempFile, documentText, 'utf8');
        const candidates = getPythonCandidates();
        let lastUnavailable = '';

        for (const executable of candidates) {
            try {
                await execFileAsync(executable, ['-m', 'py_compile', tempFile], {
                    timeout: 5000,
                    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }
                });
                return { status: 'passed', detail: `syntax checked with ${executable}` };
            } catch (err: any) {
                if (err?.code === 'ENOENT') {
                    lastUnavailable = `${executable} not found`;
                    continue;
                }
                const stderr = String(err?.stderr ?? err?.message ?? 'Python syntax validation failed').trim();
                return { status: 'failed', detail: compact(stderr) };
            }
        }

        return {
            status: 'unavailable',
            detail: lastUnavailable || 'no usable Python interpreter was found for syntax validation'
        };
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
}

export function captureSonarBaseline(uri: vscode.Uri, ruleId: string, range: vscode.Range): SonarBaseline {
    return {
        count: countMatchingRule(uri, ruleId, range),
        fingerprint: sonarFingerprint(uri)
    };
}

export async function waitForSonarValidation(
    uri: vscode.Uri,
    ruleId: string,
    range: vscode.Range,
    baseline: SonarBaseline,
    timeoutMs: number
): Promise<SonarValidationResult> {
    return new Promise(resolve => {
        let settled = false;
        let observedSonarRefresh = false;
        let latestCount = baseline.count;

        const finish = (result: SonarValidationResult) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            subscription.dispose();
            resolve(result);
        };

        const evaluate = () => {
            latestCount = countMatchingRule(uri, ruleId, range);
            const fingerprint = sonarFingerprint(uri);
            if (fingerprint !== baseline.fingerprint) {
                observedSonarRefresh = true;
            }

            if (baseline.count > 0 && latestCount < baseline.count) {
                finish({
                    status: 'passed',
                    beforeCount: baseline.count,
                    afterCount: latestCount,
                    detail: 'target Sonar rule disappeared or decreased in the refactored scope'
                });
            }
        };

        const subscription = vscode.languages.onDidChangeDiagnostics(event => {
            if (event.uris.some(changed => changed.toString() === uri.toString())) {
                setTimeout(evaluate, 250);
            }
        });

        const timer = setTimeout(() => {
            latestCount = countMatchingRule(uri, ruleId, range);
            const finalFingerprint = sonarFingerprint(uri);
            observedSonarRefresh = observedSonarRefresh || finalFingerprint !== baseline.fingerprint;

            if (baseline.count === 0) {
                finish({
                    status: 'inconclusive',
                    beforeCount: baseline.count,
                    afterCount: latestCount,
                    detail: 'the target Sonar rule was not present in the validation baseline, so SMELLCC cannot prove that it was removed'
                });
            } else if (latestCount < baseline.count) {
                finish({
                    status: 'passed',
                    beforeCount: baseline.count,
                    afterCount: latestCount,
                    detail: 'target Sonar rule disappeared or decreased in the refactored scope'
                });
            } else if (observedSonarRefresh) {
                finish({
                    status: 'failed',
                    beforeCount: baseline.count,
                    afterCount: latestCount,
                    detail: 'Sonar diagnostics refreshed but the target rule is still present in the refactored scope'
                });
            } else {
                finish({
                    status: 'inconclusive',
                    beforeCount: baseline.count,
                    afterCount: latestCount,
                    detail: 'Sonar diagnostics did not refresh before the validation timeout'
                });
            }
        }, Math.max(500, timeoutMs));

        setTimeout(evaluate, 50);
    });
}

function getPythonCandidates(): string[] {
    const configured = vscode.workspace.getConfiguration('python').get<string>('defaultInterpreterPath', '').trim();
    const candidates: string[] = [];

    if (configured && !configured.includes('${')) {
        candidates.push(configured);
    }
    if (process.platform === 'win32') {
        candidates.push('python');
    } else {
        candidates.push('python3', 'python');
    }

    return [...new Set(candidates)];
}

function countMatchingRule(uri: vscode.Uri, ruleId: string, range: vscode.Range): number {
    return getSonarDiagnostics(uri).filter(diag => {
        return getRuleId(diag) === ruleId && rangesOverlap(diag.range, range);
    }).length;
}

function sonarFingerprint(uri: vscode.Uri): string {
    return getSonarDiagnostics(uri)
        .map(diag => `${getRuleId(diag)}@${diag.range.start.line}:${diag.range.start.character}-${diag.message}`)
        .sort()
        .join('|');
}

function getSonarDiagnostics(uri: vscode.Uri): vscode.Diagnostic[] {
    return vscode.languages.getDiagnostics(uri).filter(diag => {
        return Boolean(diag.source && diag.source.toLowerCase().includes('sonar'));
    });
}

function getRuleId(diag: vscode.Diagnostic): string {
    if (typeof diag.code === 'object' && diag.code !== null) {
        return String(diag.code.value);
    }
    return diag.code ? String(diag.code) : '';
}

function rangesOverlap(a: vscode.Range, b: vscode.Range): boolean {
    return a.start.isBeforeOrEqual(b.end) && b.start.isBeforeOrEqual(a.end);
}

function compact(text: string): string {
    return text.replace(/\s+/g, ' ').slice(0, 300);
}
