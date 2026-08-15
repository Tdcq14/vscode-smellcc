// src/detector.ts
import * as vscode from 'vscode';

// 1. 定义映射关系: Sonar Rule ID -> 内部显示名称
const RULE_MAPPINGS: { [key: string]: string } = {
    // === Naming Convention (根据论文源码拆分) ===
    "python:S101":  "Naming - Class",    // Class naming
    "python:S100":  "Naming - Function", // Function naming
    "python:S116":  "Naming - Field",    // Field/Variable naming
    "python:S120":  "Naming - Method",   // Method naming (通常 S100 也涵盖 Method，视版本而定)
    "python:S1542": "Naming - Function", // General naming (CamelCase -> snake_case)
    
    // === Structure ===
    "python:S1066": "Collapsible if Statements",
    "python:S107":  "Long Parameter List", 
    "python:S125":  "Commented Code",
    
    // === Empty & Dead ===
    "python:S1105": "Empty Nested Code Blocks",
    "python:S108":  "Empty Nested Code Blocks", 
    "python:S1108": "Dead Code",           
    "python:S1854": "Dead Code",
    "python:S1763": "Dead Code", // Unreachable code
           
    // === Logic & Complexity ===
    "python:S1656": "Self-assigned Variables",
    "python:S1764": "Identical Expressions",
    "python:S2711": "Return and Yield",
    "python:S3776": "High Cognitive Complexity",
    "python:S1751": "High Cognitive Complexity" // Loops should not be infinite / empty
};

// 2. 内部类型常量
export const SMELL_TYPES = {
    NAMING_CLASS: "Naming - Class",
    NAMING_FUNC: "Naming - Function",
    NAMING_FIELD: "Naming - Field",
    NAMING_METHOD: "Naming - Method",
    
    COLLAPSIBLE_IF: "Collapsible if Statements",
    LONG_PARAM: "Long Parameter List",
    COMMENTED_CODE: "Commented Code",
    EMPTY_NESTED: "Empty Nested Code Blocks",
    DEAD_CODE: "Dead Code",
    SELF_ASSIGN: "Self-assigned Variables",
    IDENTICAL_EXPR: "Identical Expressions",
    RETURN_YIELD: "Return and Yield",
    HIGH_COMPLEXITY: "High Cognitive Complexity"
};

// 3. 映射函数
export function mapRuleToPromptType(ruleId: string): string {
    switch (ruleId) {
        case "python:S101": return SMELL_TYPES.NAMING_CLASS;
        case "python:S100": return SMELL_TYPES.NAMING_FUNC;
        case "python:S116": return SMELL_TYPES.NAMING_FIELD;
        case "python:S120": return SMELL_TYPES.NAMING_METHOD;
        
        case "python:S3776": 
        case "python:S1751": return SMELL_TYPES.HIGH_COMPLEXITY;

        case "python:S1763": 
        case "python:S1854": 
        case "python:S1108": return SMELL_TYPES.DEAD_CODE;
        
        default: return RULE_MAPPINGS[ruleId] || "Unknown";
    }
}

// 4. 从 Sonar 诊断中提取 rule id（兼容 string / { value } 两种形式）
export function getRuleIdFromDiagnostic(diagnostic: vscode.Diagnostic): string {
    if (typeof diagnostic.code === 'object' && diagnostic.code !== null) {
        return String(diagnostic.code.value);
    }
    return diagnostic.code ? String(diagnostic.code) : '';
}

/** 是否为 Sonar 系扩展（SonarLint / SonarQube / SonarQube for IDE）产生的诊断。 */
export function isSonarDiagnostic(diagnostic: vscode.Diagnostic): boolean {
    return Boolean(diagnostic.source && diagnostic.source.toLowerCase().includes('sonar'));
}

/** 该 Sonar rule 是否是 SMELLCC 支持的 smell。 */
export function isSupportedSonarRule(ruleId: string): boolean {
    return Boolean(RULE_MAPPINGS[ruleId]);
}

// 5. 品牌镜像：把 Sonar 的诊断镜像成 [SMELLCC] 诊断（默认显示模式）
export function mirrorSonarDiagnostics(
    document: vscode.TextDocument,
    collection: vscode.DiagnosticCollection
): boolean {
    const allDiagnostics = vscode.languages.getDiagnostics(document.uri);
    const smellccDiagnostics: vscode.Diagnostic[] = [];

    for (const diag of allDiagnostics) {
        if (!isSonarDiagnostic(diag)) {
            continue;
        }
        const ruleId = getRuleIdFromDiagnostic(diag);
        const displayTitle = RULE_MAPPINGS[ruleId];
        if (!displayTitle) {
            continue;
        }

        const newDiag = new vscode.Diagnostic(
            diag.range,
            `[SMELLCC] ${displayTitle}: ${diag.message}`,
            vscode.DiagnosticSeverity.Warning
        );
        newDiag.source = 'SMELLCC';
        newDiag.code = ruleId;
        smellccDiagnostics.push(newDiag);
    }

    // 内容去重：避免 set 触发 onDidChangeDiagnostics 后再镜像一遍自己
    if (diagnosticsEqual(collection.get(document.uri) ?? [], smellccDiagnostics)) {
        return false;
    }
    collection.set(document.uri, smellccDiagnostics);
    return true;
}

function diagnosticsEqual(a: readonly vscode.Diagnostic[], b: readonly vscode.Diagnostic[]): boolean {
    if (a.length !== b.length) {
        return false;
    }
    return a.every((diag, index) => {
        const other = b[index];
        return diag.range.isEqual(other.range)
            && diag.message === other.message
            && diag.severity === other.severity
            && diag.source === other.source
            && String(diag.code) === String(other.code);
    });
}