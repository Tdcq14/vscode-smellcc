import * as assert from 'assert';
import { deIndent, getMinIndentation, reIndent } from '../../indentUtils';

describe('indentUtils — pure logic', () => {

    it('getMinIndentation finds the smallest non-blank indentation', () => {
        assert.strictEqual(getMinIndentation('    a\n        b\n'), 4);
        assert.strictEqual(getMinIndentation('def f():\n    pass\n'), 0);
        assert.strictEqual(getMinIndentation('    a\n\n        b\n'), 4);
    });

    it('getMinIndentation handles empty and blank-only input', () => {
        assert.strictEqual(getMinIndentation(''), 0);
        assert.strictEqual(getMinIndentation('\n   \n\t\n'), 0);
    });

    it('deIndent removes the common prefix and normalizes blank lines', () => {
        assert.strictEqual(deIndent('    a\n    b\n', 4), 'a\nb\n');
        assert.strictEqual(deIndent('    a\n\n    b\n', 4), 'a\n\nb\n');
        assert.strictEqual(deIndent('a\nb\n', 0), 'a\nb\n');
    });

    it('reIndent adds a fixed prefix and keeps blank lines clean', () => {
        assert.strictEqual(reIndent('a\nb\n', 4), '    a\n    b\n');
        assert.strictEqual(reIndent('a\n\nb\n', 4), '    a\n\n    b\n');
        assert.strictEqual(reIndent('a\n', 0), 'a\n');
    });

    it('deIndent then reIndent round-trips', () => {
        const original = '    def f():\n        return 1\n\n    def g():\n        return 2\n';
        const stripped = deIndent(original, 4);
        assert.strictEqual(reIndent(stripped, 4), original);
    });
});
