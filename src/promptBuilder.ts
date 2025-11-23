// src/promptBuilder.ts
import { SMELL_TYPES } from './detector';

export function buildSmellCCPrompt(smellType: string, codeSnippet: string): string {
    
    const systemPrompt = `System: You are an expert software engineer. Given a context including a text describing a type of code smell, your task is to refactor the code to eliminate the code smell while the functionality implemented by the code remains unchanged.`;

    let introText = "";
    let stepsText = "";

    switch (smellType) {
        // === 新增的 4 类 Naming Prompt ===
        case SMELL_TYPES.NAMING_CLASS:
            introText = `The following code may contain irregular naming issue for class name. We need to modify the non-standard class name to comply with the naming rules: All class names should match the regular expression ^[A-Z_][a-zA-Z0-9]+$.`;
            stepsText = `To solve the problem, first identify the class name in the code to be refactored, and then modify it to conform to the class name naming rules. 
You only need to modify the identified class name, and do not make any changes to other code.`;
            break;

        case SMELL_TYPES.NAMING_METHOD:
            introText = `The following code may contain irregular naming issues for one or more method names. We need to modify them to comply with the naming rules: All method names should match the regular expression ^[a-z_][a-z0-9_]{2,}$.`;
            stepsText = `Step 1 - Identify the method name in the code and check whether its naming conforms to the naming rules we specified above.
When identifying, just pay attention to the method name in the code outside the brackets because there will be no method name inside the brackets in a line of code!
Step 2 - If the identified method name does not conform to the naming rules, modify its name to match the regular expression ^[a-z_][a-z0-9_]{2,}$; if it conforms, no modification is required.
Step 3 - Output the complete code after refactoring based on the above steps.`;
            break;

        case SMELL_TYPES.NAMING_FIELD:
            introText = `The following code may contain irregular naming issues for one or more field names. We need to modify them to comply with the naming rules: All field names should match the regular expression ^[_a-z][_a-z0-9]*$.`;
            stepsText = `Step 1 - Identify the field name in the code (usually "self.field_name = value" or "field_name = value").
Step 2 - If the identified field name does not conform to the naming rules, modify its name to match the regular expression ^[_a-z][_a-z0-9]*$.
Step 3 - Check whether the field name before and after modification has changed and conforms.
Step 4 - Output the complete code after refactoring based on the above steps.`;
            break;

        case SMELL_TYPES.NAMING_FUNC:
            introText = `The following code may contain irregular naming issues for one or more function names. We need to modify them to comply with the naming rules: All function names should match the regular expression ^[a-z_][a-z0-9_]{2,}$.`;
            stepsText = `Step 1 - Identify the function name in the code and check whether its naming conforms. Just pay attention to the function name outside the brackets!
Step 2 - If it does not conform, modify its name to match ^[a-z_][a-z0-9_]{2,}$.
Step 3 - Check whether the function name before and after modification conforms. Check for lowercase.
Step 4 - Output the complete code after refactoring based on the above steps.`;
            break;

        // === 原有的 Prompt ===
        case SMELL_TYPES.COLLAPSIBLE_IF:
            introText = `Collapsible if statements means that when two if statements are nested, we can improve the code's readability and reduce cognitive complexity by merging them.`;
            stepsText = `Your task is to understand the content of the two lines of code and then reasonably merge the two lines of code into one line of conditional statement! 
The judgment conditions should be presented in the order of the original two lines of code! 
Remember to add appropriate conjunctions at the connection point (like "and", "or", etc.), and don't forget to add a colon at the end of the merged code!`;
            break;

        case SMELL_TYPES.COMMENTED_CODE:
            introText = `Programmers should not comment out code as it bloats programs and reduces readability. So unused code should be deleted.`;
            stepsText = `The following code contains useless commented out code(excluding text comments), we need to formally delete them by replacing them with three spaces if the line that is commented out is a code line.
Specifically, if a given line of code contains a print statement or an assignment statement containing an equal sign, then that line of code must be replaced with three spaces!`;
            break;

        case SMELL_TYPES.DEAD_CODE:
            introText = `Jump statements (return, break, continue, and raise) move control flow out of the current code block. Any statements that come after a jump are dead code.`;
            stepsText = `The following code contains dead code, we need to delete them.`;
            break;

        case SMELL_TYPES.EMPTY_NESTED:
            introText = `Empty nested code blocks means nested code blocks that do not contain other statements except pass statements.`;
            stepsText = `Step 1 - Identify all empty nested code blocks in the code, giving priority to the block containing "pass". 
Step 2 - Analyze the context and choose to delete or complete detected empty code blocks. If there is enough context support to complete the empty code block, complete this code block with the correct code and use it to replace the original "pass"; otherwise, delete the entire empty code block.
Step 3 - Recheck whether there are still empty nested code blocks.
Step 4 - Output the refactored code based on the above steps.`;
            break;

        case SMELL_TYPES.HIGH_COMPLEXITY:
            introText = `Cognitive complexity measures how readable your code is. High cognitive complexity (>15) means the code is hard to read.`;
            stepsText = `Step 1 - Calculate the cognitive complexity of the original code. 
Step 2 - If > 15, split complex conditional expressions; reduce conditional branches; extract repeated code; encapsulate complex algorithms.
Step 3 - Recheck complexity.
Step 4 - Output the refactored code.`;
            break;

        case SMELL_TYPES.IDENTICAL_EXPR:
            introText = `Using the identical expressions on either side of a binary operator is almost always a mistake.`;
            stepsText = `Step 1 - Identify whether the same expression is used on both sides of a binary operator.
Step 2 - If "and"/"or" has identical expressions, delete the operator and the expression after it. If "==","!=","<=",">=", correct the expression. Arithmetic operators need not be processed.
Step 3 - Recheck.
Step 4 - Output the refactored code.`;
            break;

        case SMELL_TYPES.LONG_PARAM:
            introText = `Functions, methods and lambdas should not have too many parameters. If > 7 parameters, we consider it a long method.`;
            stepsText = `Step 1 - Check number of parameters. If > 7, go to step 2.
Step 2 - Code refactoring by extracting functions. Reduce complexity.
Step 3 - Recheck parameters count.
Step 4 - Output the refactored code.`;
            break;

        case SMELL_TYPES.RETURN_YIELD:
            introText = `Functions that use yield are known as "generators", and generators cannot return values.`;
            stepsText = `Step 1 - Detect whether "return" and "yield" appear in the same function.
Step 2 - Refactor the generator to return a complete sequence, or refactor return into yield, ensuring only one is used.
Step 3 - Recheck.
Step 4 - Output the refactored code.`;
            break;

        case SMELL_TYPES.SELF_ASSIGN:
            introText = `There is no reason to re-assign a variable to itself.`;
            stepsText = `Step 1 - Identify self-assignment.
Step 2 - Formally delete the meaningless self-assignment lines by replacing them with three spaces. If a block becomes empty, verify and remove appropriately.
Step 3 - Recheck.
Step 4 - Output the refactored code.`;
            break;

        default:
            introText = "Refactor the code to remove the code smell.";
            stepsText = "Refactor the code while preserving functionality.";
    }

    return `${systemPrompt}

Context:
${introText}

To solve the problem do the following:
${stepsText}

Please refactor the following code without using any additional quotes or triple quotes. Do not generate any explanation text nearby. No other symbols, comments, etc!!!
\`\`\`
${codeSnippet}
\`\`\``;
}