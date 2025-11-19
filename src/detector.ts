// src/detector.ts
import * as vscode from 'vscode';

export const SMELL_TYPES = {
    COLLAPSIBLE_IF: "Collapsible if Statements",
    LONG_PARAM: "Long Parameter List",
    NAMING: "Naming Convention",
    COMMENTED_CODE: "Commented Code",
    EMPTY_NESTED: "Empty Nested Code Blocks",
    DEAD_CODE: "Dead Code",
    SELF_ASSIGN: "Self-assigned Variables",
    IDENTICAL_EXPR: "Identical Expressions",
    RETURN_YIELD: "Return and Yield",
    HIGH_COMPLEXITY: "High Cognitive Complexity"
};

export function detectSmells(document: vscode.TextDocument): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();

    const addDiag = (range: vscode.Range, message: string, code: string) => {
        const diag = new vscode.Diagnostic(range, `[SMELLCC] ${message}`, vscode.DiagnosticSeverity.Warning);
        diag.code = code;
        diag.source = 'SMELLCC';
        diagnostics.push(diag);
    };

    const isCommentLine = (position: number): boolean => {
        const line = document.lineAt(document.positionAt(position));
        return line.text.trim().startsWith('#');
    };

    let match;

    // ==========================================
    // 1. Commented Code (⚡️ 升级：合并连续行)
    // ==========================================
    // 策略：先找出所有单行，然后手动合并连续的 Range
    const regexCommentedSingle = /^\s*#\s*(?:(?:def|class|if|for|while|return|import|from|raise|try|except|with)\b|[a-zA-Z_]\w*\s*=[^=]|[a-zA-Z_]\w*\(.*\))/gm;
    let commentedRanges: vscode.Range[] = [];
    
    while ((match = regexCommentedSingle.exec(text)) !== null) {
        if (/[\u4e00-\u9fa5]/.test(match[0])) continue;
        const start = document.positionAt(match.index);
        const end = document.positionAt(match.index + match[0].length);
        commentedRanges.push(new vscode.Range(start, end));
    }
    // 合并连续的 Range
    if (commentedRanges.length > 0) {
        let mergedRanges: vscode.Range[] = [];
        let current = commentedRanges[0];
        for (let i = 1; i < commentedRanges.length; i++) {
            const next = commentedRanges[i];
            // 如果下一行紧挨着当前行 (行号差1)
            if (next.start.line === current.end.line + 1) {
                current = current.union(next);
            } else {
                mergedRanges.push(current);
                current = next;
            }
        }
        mergedRanges.push(current);
        
        mergedRanges.forEach(r => addDiag(r, "Block of commented out code.", SMELL_TYPES.COMMENTED_CODE));
    }


    // 2. Collapsible if
    const regexCollapsible = /if\s+.+:\s*\r?\n\s+(\s+)if\s+.+:/g;
    while ((match = regexCollapsible.exec(text)) !== null) {
        if (isCommentLine(match.index)) continue;
        addDiag(new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + match[0].length)), "Merge nested 'if' statements.", SMELL_TYPES.COLLAPSIBLE_IF);
    }

    // 3. Long Parameter List
    const regexFunc = /def\s+\w+\s*\(([^)]*)\):/g;
    while ((match = regexFunc.exec(text)) !== null) {
        if (isCommentLine(match.index)) continue;
        if (match[1].split(',').length > 4) addDiag(new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + match[0].length)), "Long Parameter List detected.", SMELL_TYPES.LONG_PARAM);
    }

    // 4. Naming Convention
    const regexNaming = /def\s+([a-zA-Z0-9_]*[A-Z][a-zA-Z0-9_]*)\s*\(/g;
    while ((match = regexNaming.exec(text)) !== null) {
        if (isCommentLine(match.index)) continue;
        addDiag(new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + match[0].length)), "Function name should be snake_case.", SMELL_TYPES.NAMING);
    }

    // 5. Empty Nested
    const regexEmpty = /:\s*\r?\n\s+pass[\t ]*(#.*)?(\r?\n|$)/g;
    while ((match = regexEmpty.exec(text)) !== null) {
        addDiag(new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + match[0].length)), "Empty block with only 'pass'.", SMELL_TYPES.EMPTY_NESTED);
    }

    // 6. Self-assigned
    const regexSelfAssign = /\b(\w+)\s*=\s*\1\b(?!\s*[\+\-\*\/])/g;
    while ((match = regexSelfAssign.exec(text)) !== null) {
        if (isCommentLine(match.index)) continue;
        addDiag(new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + match[0].length)), "Useless self-assignment.", SMELL_TYPES.SELF_ASSIGN);
    }

    // 7. Identical Expr
    const regexIdentical = /\b(\w+)\s*(==|!=|>=|<=)\s*\1\b/g;
    while ((match = regexIdentical.exec(text)) !== null) {
        if (isCommentLine(match.index)) continue;
        addDiag(new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + match[0].length)), "Identical expression comparison.", SMELL_TYPES.IDENTICAL_EXPR);
    }

    // 8. Dead Code (⚡️ 升级：合并连续行)
    // 先找所有的 dead line，再合并
    const regexDeadSingle = /^\s*return\s+.*(\r?\n\s+(?!\s*$)(?!\s*#)(?!\s*(?:elif|else|except|finally|def|class)).+)/gm;
    // 注意：由于 regexDeadSingle 捕获的是 return + 下一行，我们需要特殊处理范围
    // 这里简化处理：只标记 return 后面那一行，然后依靠上面的合并逻辑
    // 为了稳健，这里采用单独的合并逻辑
    
    // 重新实现 Dead Code 检测：扫描每个函数，找到 return 后的不可达块
    // (正则难以完美实现多行 Dead Code 合并，这里简化为：只标记第一行不可达代码，修复时 Prompt 会处理整块)
    while ((match = regexDeadSingle.exec(text)) !== null) {
        if (isCommentLine(match.index)) continue;
        // 捕获组 1 是 return 后的那一行
        const startIdx = match.index + match[0].lastIndexOf(match[1]);
        const endIdx = startIdx + match[1].length;
        addDiag(new vscode.Range(document.positionAt(startIdx), document.positionAt(endIdx)), "Unreachable code after return.", SMELL_TYPES.DEAD_CODE);
    }


    // 9. Return and Yield
    const regexReturnYield = /def\s+\w+\s*\([^)]*\):(?:(?!\bdef\b)[\s\S])*?(?:\syield\s(?:(?!\bdef\b)[\s\S])*?\sreturn\s|\sreturn\s(?:(?!\bdef\b)[\s\S])*?\syield\s)/g;
    while ((match = regexReturnYield.exec(text)) !== null) {
        if (isCommentLine(match.index)) continue;
        const start = document.positionAt(match.index);
        const end = document.positionAt(match.index + 20);
        addDiag(new vscode.Range(start, end), "Function contains both 'yield' and 'return'.", SMELL_TYPES.RETURN_YIELD);
    }

    // 10. High Complexity
    const regexDeepNesting = /^(\s{16,}|\t{4,})\S/gm;
    while ((match = regexDeepNesting.exec(text)) !== null) {
        if (isCommentLine(match.index)) continue;
        const start = document.positionAt(match.index);
        const end = document.positionAt(match.index + match[0].length);
        addDiag(new vscode.Range(start, end), "High Cognitive Complexity detected.", SMELL_TYPES.HIGH_COMPLEXITY);
    }

    return diagnostics;
}