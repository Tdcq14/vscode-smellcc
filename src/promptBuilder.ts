// src/promptBuilder.ts
import { SMELL_TYPES } from './detector';
import { getMinIndentation, deIndent, reIndent } from './indentUtils';

export function buildSmellCCPrompt(
    smellType: string, 
    codeSnippet: string, 
    sonarMessage: string = "", 
    relativeLine: number = 0,
    targetLineText: string = "" // [NEW] 接收代码内容用于定位
): string {

    // === 1. 预处理：去缩进 ===
    const baseIndent = getMinIndentation(codeSnippet);
    const cleanCode = deIndent(codeSnippet, baseIndent);
    
    // 2. 智能上下文检测
    const isClassContext = /self\.|def\s+\w+\s*\(self/.test(cleanCode);
    let codeToPrompt = cleanCode;
    
    // === 策略：伪装类上下文 (仅针对高认知复杂度) ===
    if (isClassContext && smellType === SMELL_TYPES.HIGH_COMPLEXITY) {
        codeToPrompt = `class RefactoringContext:\n${reIndent(cleanCode, 4)}`;
    }

    // 系统提示词：设定严格规则
    const systemPrompt = `System: You are an expert Python developer. Your task is to refactor the provided code to fix a specific code smell reported by SonarQube.

CRITICAL RULES:
1. **NO LOGIC CHANGES**: The functionality must remain EXACTLY the same.
2. **OUTPUT**: Return ONLY the raw Python code. NO Markdown, NO explanations.
3. **INDENTATION**: The input code is flattened (0-indent). Your output MUST start at 0-indent.`;

    // 注入上下文：加入代码内容验证
    let contextInfo = `[SonarQube Report]\nIssue Type: ${smellType}\nMessage: "${sonarMessage}"`;
    if (relativeLine > 0) {
        contextInfo += `\nTarget Location: Line ${relativeLine}.`;
        if (targetLineText) {
            contextInfo += `\nTarget Code Verification: The line at location ${relativeLine} MUST MATCH: "${targetLineText}"`;
        }
    }

    let introText = "";
    let promptInstructions = "";

    switch (smellType) {
        // ==========================================
        // 1. Naming Conventions (Group 1-4)
        // ==========================================
        case SMELL_TYPES.NAMING_CLASS:
            introText = `Irregular class name detected. Must match ^[A-Z_][a-zA-Z0-9]+$ (CamelCase).`;
            promptInstructions = `1. Identify the class at **Line ${relativeLine}**.
2. Rename it to CamelCase (e.g., 'my_class' -> 'MyClass').
3. Update ALL usages.`;
            break;

        case SMELL_TYPES.NAMING_FUNC: 
            introText = `Irregular function name detected. Must match ^[a-z_][a-z0-9_]{2,}$ (snake_case).`;
            promptInstructions = `1. Identify the function at **Line ${relativeLine}**.
2. Rename it to snake_case (e.g., 'myFunc' -> 'my_func').
3. Update ALL usages.`;
            break;

        case SMELL_TYPES.NAMING_METHOD:
            introText = `Irregular method name detected. Must match ^[a-z_][a-z0-9_]{2,}$ (snake_case).`;
            promptInstructions = `1. Identify the method at **Line ${relativeLine}**.
2. Rename it to snake_case.
3. Update ALL usages.`;
            break;

        case SMELL_TYPES.NAMING_FIELD:
            introText = `Irregular field name detected. Must match ^[_a-z][_a-z0-9]*$ (snake_case).`;
            promptInstructions = `1. Identify the field (self.xxx) at **Line ${relativeLine}**.
2. Rename it to snake_case.
3. Update ALL usages.`;
            break;

        // ==========================================
        // 2. Long Parameter List
        // ==========================================
        case SMELL_TYPES.LONG_PARAM:
            introText = `Function has too many parameters (>7).`;
            promptInstructions = `1. Check function signature at **Line ${relativeLine}**.
2. Strategy: Group parameters into a dictionary (e.g. **kwargs) or object IF it improves readability.
3. If grouping is unsafe/unclear, simplify formatting only.`;
            break;

        // ==========================================
        // 3. Empty Nested Code Blocks (Problem 3 Fix)
        // ==========================================
        case SMELL_TYPES.EMPTY_NESTED:
            introText = `Empty block or 'pass' detected.`;
            promptInstructions = `1. Locate 'pass' at **Line ${relativeLine}**.
2. **Fix**:
   - 'if A: pass; else: B' -> 'if not A: B'.
   - Standalone 'if A: pass' -> Remove if A has no side effects.
   - In loop -> Use 'continue'?
3. **PROHIBITION**: Do NOT replace 'pass' with 'return'. Keep 'pass' if removal breaks syntax.`;
            break;

        // ==========================================
        // 4. Collapsible if Statements (Problem 4 Ultimate Fix)
        // ==========================================
        case SMELL_TYPES.COLLAPSIBLE_IF:
            introText = `Merge nested 'if' statements.`;
            promptInstructions = `You must perform a strictly mechanical merge based on the code content.

1. **LOCATE TARGET (Inner IF)**: 
   - Find the line at **Line ${relativeLine}**.
   - **VERIFY**: The code MUST MATCH: "${targetLineText}".
   - This line is your [Inner IF].

2. **LOCATE PARENT (Outer IF)**: 
   - Identify the 'if' statement strictly immediately above [Inner IF] (ignoring blank lines/comments). This is [Outer IF].

3. **SAFETY CHECK**: 
   - Are there any executable statements (assignments, prints, etc.) BETWEEN [Outer IF] and [Inner IF]?
   - **YES**: STOP. Output original code unchanged.
   - **NO**: Proceed.

4. **MERGE ACTION**:
   - Condition: "if (Outer_Condition) and (Inner_Condition):"
   - **Indent Fix**: Delete [Inner IF] line. Un-indent the body of [Inner IF] so it sits directly inside the new merged IF.

Example:
  Input:
    if A:          <-- Outer
        if B:      <-- Inner ("${targetLineText}")
            do()
  Output:
    if (A) and (B):
        do()`;
            break;

        // ==========================================
        // 5. Commented Code
        // ==========================================
        case SMELL_TYPES.COMMENTED_CODE:
            introText = `Commented-out code detected.`;
            promptInstructions = `1. Check comments near **Line ${relativeLine}**.
2. If it is code (e.g. '# x=1'), DELETE it.
3. If it is text documentation, KEEP it.`;
            break;

        // ==========================================
        // 6. Self-assigned Variables
        // ==========================================
        case SMELL_TYPES.SELF_ASSIGN:
            introText = `Redundant self-assignment (x = x).`;
            promptInstructions = `1. Locate assignment at **Line ${relativeLine}**.
2. DELETE the redundant line.
3. Handle empty blocks if necessary (remove else, or add pass).`;
            break;

        // ==========================================
        // 7. Identical Expressions (Problem 7 Fix)
        // ==========================================
        case SMELL_TYPES.IDENTICAL_EXPR:
            introText = `Identical expression detected (e.g. a == a).`;
            promptInstructions = `1. Locate expression at **Line ${relativeLine}**.
2. **STRICT PROHIBITION**: 
   - **NEVER** replace with 'True' or 'False'.
   - **NEVER** delete the check.

3. **STRATEGY**:
   - Infer intent: Is there a variable with a similar name? (e.g. 'a == b') -> Fix typo.
   - **If Ambiguous**: Do NOT change logic. Output original code and append comment: "# FIXME: Identical expression".`;
            break;

        // ==========================================
        // 8. Dead Code
        // ==========================================
        case SMELL_TYPES.DEAD_CODE:
            introText = `Unreachable code after jump statement.`;
            promptInstructions = `1. Locate jump (return/break/raise) near **Line ${relativeLine}**.
2. DELETE code physically following it in the same block.`;
            break;

        // ==========================================
        // 9. Return and Yield
        // ==========================================
        case SMELL_TYPES.RETURN_YIELD:
            introText = `Function mixes 'return' (with value) and 'yield'.`;
            promptInstructions = `1. Analyze function intent.
2. If Generator: Ensure 'return' has no value (just 'return').
3. If Delegation: Use 'yield from'.`;
            break;

        // ==========================================
        // 10. High Cognitive Complexity
        // ==========================================
        case SMELL_TYPES.HIGH_COMPLEXITY:
            introText = `Code is too complex (deep nesting).`;
            promptInstructions = `1. Analyze logic at **Line ${relativeLine}**.
2. Simplify:
   - Extract inner logic to sibling helper function (start with '_').
   - Use early returns to reduce nesting.
3. Constraint: Do NOT nest new functions inside original.`;
            break;

        default:
            introText = `Refactor to remove '${smellType}'.`;
            promptInstructions = `Fix the issue at **Line ${relativeLine}**. Keep logic strictly unchanged.`;
            break;
    }

    // === 3. Assemble Final Prompt ===
    return `${systemPrompt}

Context:
${introText}

${contextInfo}

Action Steps:
${promptInstructions}

Code to Refactor:
\`\`\`python
${codeToPrompt}
\`\`\``;
}