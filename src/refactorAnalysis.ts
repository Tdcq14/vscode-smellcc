export type RiskLevel = 'low' | 'medium' | 'high';

export type ChangeRisk = {
    level: RiskLevel;
    addedLines: number;
    removedLines: number;
    changedLines: number;
    editRatio: number;
    signatureChanged: boolean;
    reasons: string[];
    externalReferenceCount: number;
};

export function analyzeChangeRisk(before: string, after: string, smellType: string, externalReferenceCount: number = 0): ChangeRisk {
    const beforeLines = splitLines(before);
    const afterLines = splitLines(after);
    const lcs = longestCommonSubsequenceLength(beforeLines, afterLines);
    const removedLines = Math.max(0, beforeLines.length - lcs);
    const addedLines = Math.max(0, afterLines.length - lcs);
    const changedLines = addedLines + removedLines;
    const editRatio = changedLines / Math.max(1, beforeLines.length + afterLines.length);

    const beforeSignature = extractFunctionSignature(beforeLines);
    const afterSignature = extractFunctionSignature(afterLines);
    const signatureChanged = Boolean(beforeSignature && afterSignature && beforeSignature !== afterSignature);
    const signatureChangeExpected =
        smellType === 'Long Parameter List' ||
        smellType.startsWith('Naming - Function') ||
        smellType.startsWith('Naming - Method');

    let score = 0;
    const reasons: string[] = [];

    if (signatureChanged && !signatureChangeExpected) {
        score += 3;
        reasons.push('function signature changed outside a signature-oriented smell');
    }

    if (externalReferenceCount > 0 && (signatureChanged || smellType.startsWith('Naming -'))) {
        score += 3;
        reasons.push(`${externalReferenceCount} reference(s) exist outside the preview scope and may require coordinated edits`);
    }

    if (editRatio >= 0.55 && changedLines >= 12) {
        score += 3;
        reasons.push(`${Math.round(editRatio * 100)}% of compared lines changed`);
    } else if (editRatio >= 0.3 && changedLines >= 8) {
        score += 1;
        reasons.push(`${Math.round(editRatio * 100)}% of compared lines changed`);
    }

    if (changedLines >= 40) {
        score += 3;
        reasons.push(`${changedLines} changed lines is a large refactor for a quick fix`);
    } else if (changedLines >= 20) {
        score += 1;
        reasons.push(`${changedLines} lines changed`);
    }

    const deletionRatio = removedLines / Math.max(1, beforeLines.length);
    if (removedLines >= 8 && deletionRatio >= 0.4) {
        score += 2;
        reasons.push(`${Math.round(deletionRatio * 100)}% of the original scope was removed`);
    }

    const level: RiskLevel = score >= 3 ? 'high' : score >= 1 ? 'medium' : 'low';
    return {
        level,
        addedLines,
        removedLines,
        changedLines,
        editRatio,
        signatureChanged,
        reasons,
        externalReferenceCount
    };
}

function splitLines(text: string): string[] {
    if (!text) {
        return [];
    }
    return text.replace(/\r\n/g, '\n').split('\n');
}

function longestCommonSubsequenceLength(a: string[], b: string[]): number {
    if (a.length === 0 || b.length === 0) {
        return 0;
    }

    const previous = new Array<number>(b.length + 1).fill(0);
    const current = new Array<number>(b.length + 1).fill(0);

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            current[j] = a[i - 1] === b[j - 1]
                ? previous[j - 1] + 1
                : Math.max(previous[j], current[j - 1]);
        }
        for (let j = 0; j <= b.length; j++) {
            previous[j] = current[j];
            current[j] = 0;
        }
    }

    return previous[b.length];
}

function extractFunctionSignature(lines: string[]): string | undefined {
    const start = lines.findIndex(line => /^\s*(async\s+)?def\s+/.test(line));
    if (start < 0) {
        return undefined;
    }

    const parts: string[] = [];
    let parenDepth = 0;
    let sawParen = false;

    for (let i = start; i < Math.min(lines.length, start + 20); i++) {
        const line = lines[i].trim();
        parts.push(line);
        for (const char of line) {
            if (char === '(') {
                parenDepth++;
                sawParen = true;
            } else if (char === ')') {
                parenDepth--;
            }
        }
        if (sawParen && parenDepth <= 0 && line.includes(':')) {
            break;
        }
    }

    return parts.join(' ').replace(/\s+/g, ' ').trim();
}
