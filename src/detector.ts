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

// 4. 镜像诊断逻辑
export function mirrorSonarDiagnostics(
    document: vscode.TextDocument, 
    collection: vscode.DiagnosticCollection
) {
    const allDiagnostics = vscode.languages.getDiagnostics(document.uri);
    const smellccDiagnostics: vscode.Diagnostic[] = [];

    for (const diag of allDiagnostics) {
        // 兼容 SonarLint / SonarQube / SonarQube for IDE 等多种 source 名称
        if (diag.source && diag.source.toLowerCase().includes('sonar')) {
            let ruleId = '';
            if (typeof diag.code === 'object' && diag.code !== null) {
                ruleId = String(diag.code.value);
            } else if (diag.code) {
                ruleId = String(diag.code);
            }

            const displayTitle = RULE_MAPPINGS[ruleId];

            if (displayTitle) {
                const newDiag = new vscode.Diagnostic(
                    diag.range, 
                    `[SMELLCC] ${displayTitle}: ${diag.message}`, 
                    vscode.DiagnosticSeverity.Warning
                );
                newDiag.source = 'SMELLCC';
                newDiag.code = ruleId;
                smellccDiagnostics.push(newDiag);
            }
        }
    }
    collection.set(document.uri, smellccDiagnostics);
}

// 5. 辅助函数
export function getSmellTypeFromDiagnostic(diagnostic: vscode.Diagnostic): string | undefined {
    if (!diagnostic.source || !diagnostic.source.toLowerCase().includes('sonar')) {
        return undefined;
    }
    let ruleId = '';
    if (typeof diagnostic.code === 'string') {
        ruleId = diagnostic.code;
    } else if (diagnostic.code && typeof diagnostic.code === 'object') {
        ruleId = String(diagnostic.code.value);
    }
    const basicType = RULE_MAPPINGS[ruleId];
    if (!basicType) {return undefined;}
    
    return mapRuleToPromptType(ruleId);
}