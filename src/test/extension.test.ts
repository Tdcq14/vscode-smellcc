import * as assert from 'assert';

// 引入 VS Code 模块
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('SMELLCC Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	// 1. 基础单元测试 (确保环境没问题)
	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	// 2. 核心功能检查：验证我们的重构命令是否注册成功
	test('Command "smellcc.refactor" should be registered', async () => {
		// 获取 VS Code 中所有已注册的命令列表
		const allCommands = await vscode.commands.getCommands(true);
		
		// 检查我们的命令是否在列表里
		const isCommandRegistered = allCommands.includes('smellcc.refactor');
		
		// 如果这里报错，说明 extension.ts 里的 registerCommand 写错了或者插件没激活
		assert.strictEqual(isCommandRegistered, true, 'Refactor command is missing!');
	});
});