// src/promptBuilder.ts
import { SMELL_TYPES } from './detector';

export function buildSmellCCPrompt(smellType: string, codeSnippet: string): string {
    
    const role = `Role: You are an expert software engineer. Your task is to refactor the provided Python code to eliminate the specific code smell.
CRITICAL RULES:
1. Return ONLY the refactored code. No explanations.
2. PRESERVE the original indentation and surrounding logic.
3. Do not change the logic behavior.`;

    let strategy = "";

    switch (smellType) {
        // ============================================================
        // 1. Collapsible If (⚡️ 修复：使用抽象变量 A/B，防止内容污染)
        // ============================================================
        case SMELL_TYPES.COLLAPSIBLE_IF:
            strategy = `Task: Merge nested if statements.
Steps: Combine the conditions using 'and'. Keep the inner body code exactly as is.
Instructions:
- Do NOT add new print statements.
- Do NOT change variable names.
- Do NOT invent new logic (like 'y < 10').
Few-shot Example:
Input:
if condition_A:
    if condition_B:
        original_action()
Output:
if condition_A and condition_B:
    original_action()`;
            break;

        // 2. Long Parameter List
        case SMELL_TYPES.LONG_PARAM:
            strategy = `Task: Refactor Long Parameter List.
Steps: 1. Group parameters into a dictionary named 'params'. 2. Update the function definition. 3. Update variable access inside the function.
Few-shot Example:
Input:
def func(a, b, c, d):
    return a + b
Output:
def func(params):
    return params['a'] + params['b']`;
            break;

        // 3. Naming Convention
        case SMELL_TYPES.NAMING:
            strategy = `Task: Fix Naming Convention (Snake Case).
Steps: Rename the function to snake_case. Keep the body EXACTLY the same.
Few-shot Example:
Input:
def MyFunction(x):
    return x * 2
Output:
def my_function(x):
    return x * 2`;
            break;

        // 4. Empty Nested Block
        case SMELL_TYPES.EMPTY_NESTED:
            strategy = `Task: Handle Empty Block.
Steps: 1. If the 'if' block is empty and has no 'else', remove the entire statement. 2. If 'else' exists, invert the 'if' condition and remove the empty block. 3. Only keep 'pass' if absolutely necessary.
Few-shot Example:
Input:
    if x > 0:
        pass
    else:
        do_something()
Output:
    if x <= 0:
        do_something()`;
            break;

        // 5. Self Assigned
        case SMELL_TYPES.SELF_ASSIGN:
            strategy = `Task: Remove Self-assignment.
Steps: Remove redundant lines like 'x = x'. Return the rest of the code.
Few-shot Example:
Input:
    x = 1
    x = x
    return x
Output:
    x = 1
    return x`;
            break;

        // 6. Dead Code
        case SMELL_TYPES.DEAD_CODE:
            strategy = `Task: Remove Dead Code.
Steps: Identify lines of code after 'return' that are unreachable. Delete them.
Few-shot Example:
Input:
def check(val):
    if val > 0:
        return True
    print("Unreachable")
Output:
def check(val):
    if val > 0:
        return True`;
            break;
        
        // 7. Identical Expression
        case SMELL_TYPES.IDENTICAL_EXPR:
            strategy = `Task: Fix Identical Expressions.
Steps: Simplify the logical expression (e.g., 'x == x' is always True) or fix the logic error.
Few-shot Example:
Input:
if a == a:
    return True
Output:
if True:
    return True`;
            break;

        // 8. Return and Yield
        case SMELL_TYPES.RETURN_YIELD:
            strategy = `Task: Fix Return and Yield conflict.
Steps: A Python generator cannot have a return with a value. DELETE the return statement or change it to 'raise StopIteration'. DO NOT comment it out.
Few-shot Example:
Input:
def gen():
    yield 1
    return "stop"
Output:
def gen():
    yield 1
    # Return statement removed`;
            break;

        // 9. High Complexity
        case SMELL_TYPES.HIGH_COMPLEXITY:
            strategy = `Task: Reduce Cognitive Complexity.
Steps: 1. Identify the deepest nested logic block. 2. Extract that block into a separate helper function. 3. Replace the block with a function call.
Few-shot Example:
Input:
def main(data):
    if data:
        for item in data:
            if item.check():
                process(item)
Output:
def _process_item(item):
    if item.check():
        process(item)

def main(data):
    if data:
        for item in data:
            _process_item(item)`;
            break;
        
        // 10. Commented Code
        case SMELL_TYPES.COMMENTED_CODE:
             strategy = `Task: Remove Commented Code.
Steps: The input is a commented-out line of code. Return an empty string to delete it.
Few-shot Example:
Input:
# print(x)
Output:
`; 
            break;

        default:
            strategy = `Task: Clean code smell '${smellType}'. Apply standard refactoring techniques.`;
            break;
    }

    return `${role}\n\n${strategy}\n\nTarget Code:\n${codeSnippet}`;
}