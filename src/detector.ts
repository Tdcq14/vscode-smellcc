// src/detector.ts
import * as vscode from 'vscode';

// 1. 定义映射关系
const RULE_MAPPINGS: { [key: string]: string } = {
    // Naming Convention
    "python:S101":  "Naming Convention",
    "python:S100":  "Naming Convention",
    "python:S116":  "Naming Convention",
    "python:S120":  "Naming Convention",
    "python:S1542": "Naming Convention",
    
    // Structure
    "python:S1066": "Collapsible if Statements",
    "python:S107":  "Long Parameter List", 
    "python:S125":  "Commented Code",
    
    // Empty Blocks
    "python:S1105": "Empty Nested Code Blocks",
    "python:S108":  "Empty Nested Code Blocks", 
    
    // Dead Code (补全了 S1763)
    "python:S1108": "Dead Code",           
    "python:S1854": "Dead Code",
    "python:S1763": "Dead Code", // <--- 新增这个
           
    "python:S1656": "Self-assigned Variables",
    "python:S1764": "Identical Expressions",
    "python:S2711": "Return and Yield",
    "python:S3776": "High Cognitive Complexity"
};

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

export function mapRuleToPromptType(ruleId: string): string {
    switch (ruleId) {
        case "python:S101": return SMELL_TYPES.NAMING_CLASS;
        case "python:S100": return SMELL_TYPES.NAMING_FUNC;
        case "python:S116": return SMELL_TYPES.NAMING_FIELD;
        case "python:S120": return SMELL_TYPES.NAMING_METHOD;
        // 特殊处理: 如果是 Dead Code 家族
        case "python:S1763": 
        case "python:S1854": 
        case "python:S1108": return SMELL_TYPES.DEAD_CODE;
        default: return RULE_MAPPINGS[ruleId] || "Unknown";
    }
}

export function mirrorSonarDiagnostics(
    document: vscode.TextDocument, 
    collection: vscode.DiagnosticCollection
) {
    const allDiagnostics = vscode.languages.getDiagnostics(document.uri);
    const smellccDiagnostics: vscode.Diagnostic[] = [];

    for (const diag of allDiagnostics) {
        // 只要 source 包含 sonar (忽略大小写)
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
    if (!basicType) return undefined;
    
    return mapRuleToPromptType(ruleId);
}