## SMELLCC v0.0.9

### Cleaner display: no more duplicated diagnostics

SMELLCC no longer mirrors Sonar diagnostics into its own `[SMELLCC]` collection. The Problems panel now shows **only Sonar's own warnings**, and the SMELLCC quick fix is attached directly to them via the lightbulb.

This also removes the entire stale-mirror bug class (ghost diagnostics after Apply, entries disappearing after re-analysis, sync timing issues) — without a mirror, they are structurally impossible.

Note: "SonarQube for IDE" is the renamed SonarLint (same extension `sonarsource.sonarlint-vscode`). SMELLCC uses it as the detection engine; there is no kernel-only package.

### Install

1. Download `vscode-smellcc-0.0.9.vsix`
2. VS Code → Extensions → "..." → Install from VSIX → Reload Window
3. Command Palette → `SMELLCC: Set API Key (SecretStorage)` (if not set)
4. Lightbulb on any supported Sonar warning → `Refactor: ... (SMELLCC)`
