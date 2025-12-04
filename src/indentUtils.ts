// src/indentUtils.ts

/**
 * 计算代码块的最小公共缩进长度
 * (忽略空行，只看有代码的行)
 */
export function getMinIndentation(code: string): number {
    const lines = code.split('\n');
    let minIndent = Infinity;
    let foundCode = false;

    for (const line of lines) {
        // 跳过空行
        if (line.trim().length === 0) continue;
        
        // 匹配行首空白
        const match = line.match(/^(\s*)/);
        if (match) {
            const indentLen = match[1].length;
            if (indentLen < minIndent) {
                minIndent = indentLen;
            }
            foundCode = true;
        }
    }

    // 如果全是空行或没缩进，返回 0
    return foundCode ? minIndent : 0;
}

/**
 * 移除公共缩进 (De-indent / Normalize)
 * 让代码块左对齐
 */
export function deIndent(code: string, indentSize: number): string {
    if (indentSize === 0) return code;
    
    const lines = code.split('\n');
    return lines.map(line => {
        // 如果是空行，保持原样（或者清空空白字符）
        if (line.trim().length === 0) return '';
        
        // 移除前缀的 indentSize 个字符
        // 防御性编程：如果某行缩进小于 indentSize（理论上不应发生），则trimLeft
        if (line.length >= indentSize) {
            return line.substring(indentSize);
        }
        return line.trimStart();
    }).join('\n');
}

/**
 * 增加缩进 (Re-indent)
 * 恢复代码块的上下文层级
 */
export function reIndent(code: string, indentSize: number): string {
    if (indentSize === 0) return code;
    const indentString = ' '.repeat(indentSize);
    
    const lines = code.split('\n');
    return lines.map(line => {
        // 空行不加缩进，保持干净
        if (line.trim().length === 0) return '';
        return indentString + line;
    }).join('\n');
}