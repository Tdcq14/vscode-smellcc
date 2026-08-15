## SMELLCC v0.0.4

Reviewable, verifiable LLM refactoring workflow on top of SonarLint diagnostics.

### Highlights

- **Native Diff Review** — before/after proposal opens in VS Code's diff editor; nothing is mutated until the developer chooses Apply or Reject
- **Change-Risk Guard** — +added/-removed lines, edit ratio, deletion ratio, unexpected signature changes
- **Workspace Impact Guard** — reference-provider lookup for naming / long-parameter smells; external references escalate the proposal to high risk
- **Completion Integrity Guard** — empty, truncated (`finish_reason=length`) or timed-out LLM responses are rejected
- **Pre-apply Syntax Gate** — full proposed document is checked with `py_compile`; broken syntax is blocked before Apply
- **Post-apply Sonar Validation** — waits for Sonar diagnostics to refresh and reports passed / failed / inconclusive; failure offers a safe undo
- **Guarded Undo** — refuses to roll back if the developer has edited the refactored region afterwards
- **Refactor History View** — Explorer tree records apply / reject / undo, risk level, changed lines, syntax and validation results
- Unit tests (`npm test`) and lint (`npm run lint`) wired into the build

### Install

1. Download `vscode-smellcc-0.0.4.vsix` below
2. VS Code → Extensions → "..." → **Install from VSIX**
3. Requires **SonarLint** (JRE 17+). Configure `Smellcc: Api Key` (default model: `deepseek-chat`)
4. Open a Python file with a supported SonarLint smell and use the lightbulb quick fix
