import * as assert from 'assert';
import { analyzeChangeRisk } from '../../refactorAnalysis';

describe('refactorAnalysis — change risk guard (pure logic)', () => {

    it('identical text is a low-risk no-op', () => {
        const code = 'def f():\n    return 1\n';
        const risk = analyzeChangeRisk(code, code, 'Dead Code', 0);
        assert.strictEqual(risk.level, 'low');
        assert.strictEqual(risk.changedLines, 0);
        assert.strictEqual(risk.editRatio, 0);
        assert.strictEqual(risk.signatureChanged, false);
    });

    it('signature change outside a signature-oriented smell is high risk', () => {
        const before = 'def calc(a, b):\n    return a + b\n';
        const after = 'def calc(x, y):\n    return x + y\n';
        const risk = analyzeChangeRisk(before, after, 'Dead Code', 0);
        assert.strictEqual(risk.level, 'high');
        assert.strictEqual(risk.signatureChanged, true);
        assert.ok(risk.reasons.some(r => r.includes('signature changed')));
    });

    it('external references plus naming smell is high risk', () => {
        const before = 'def myFunc():\n    pass\n';
        const after = 'def my_func():\n    pass\n';
        const risk = analyzeChangeRisk(before, after, 'Naming - Function', 2);
        assert.strictEqual(risk.level, 'high');
        assert.strictEqual(risk.externalReferenceCount, 2);
        assert.ok(risk.reasons.some(r => r.includes('2 reference(s)')));
    });

    it('a small cosmetic edit stays low risk', () => {
        const before = 'x = 1\ny = 2\n';
        const after = 'x = 1\ny = 3\n';
        const risk = analyzeChangeRisk(before, after, 'Unknown', 0);
        assert.strictEqual(risk.level, 'low');
    });

    it('moderate edit ratio with enough lines becomes medium risk', () => {
        const before = Array.from({ length: 10 }, (_, i) => `line_${i}`).join('\n') + '\n';
        const after = [
            ...Array.from({ length: 6 }, (_, i) => `line_${i}`),
            ...Array.from({ length: 4 }, (_, i) => `new_${i}`)
        ].join('\n') + '\n';
        const risk = analyzeChangeRisk(before, after, 'Unknown', 0);
        assert.strictEqual(risk.level, 'medium');
        assert.strictEqual(risk.changedLines, 8);
    });

    it('massive rewrite with heavy deletion is high risk', () => {
        const before = Array.from({ length: 20 }, (_, i) => `a${i}`).join('\n') + '\n';
        const after = Array.from({ length: 12 }, (_, i) => `b${i}`).join('\n') + '\n';
        const risk = analyzeChangeRisk(before, after, 'Unknown', 0);
        assert.strictEqual(risk.level, 'high');
        assert.ok(risk.reasons.length >= 3);
        assert.ok(risk.reasons.some(r => r.includes('lines changed')));
        assert.ok(risk.reasons.some(r => r.includes('% of the original scope was removed')));
    });

    it('pure deletion of a few lines is low risk', () => {
        const before = Array.from({ length: 10 }, (_, i) => `k${i}`).join('\n') + '\n';
        const after = Array.from({ length: 5 }, (_, i) => `k${i}`).join('\n') + '\n';
        const risk = analyzeChangeRisk(before, after, 'Unknown', 0);
        assert.strictEqual(risk.level, 'low');
        assert.strictEqual(risk.removedLines, 5);
    });

    it('external reference count defaults to zero and is reported', () => {
        const code = 'x = 1\n';
        const risk = analyzeChangeRisk(code, code + 'y = 2\n', 'Unknown');
        assert.strictEqual(risk.externalReferenceCount, 0);
    });
});
