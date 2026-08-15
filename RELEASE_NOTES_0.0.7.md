## SMELLCC v0.0.7

### Fixed: ghost diagnostics after Apply

SMELLCC only mirrors Sonar diagnostics — it never detects smells on its own. After a refactor was applied, the old mirrored diagnostic could linger with a stale range ("already fixed, but still highlighted, weird squiggle"), because Sonar re-analyzes asynchronously.

v0.0.7 now:

- clears SMELLCC's mirror for the refactored document **immediately after Apply**;
- re-syncs from Sonar once its async re-analysis completes;
- defaults `Smellcc: Auto Save After Apply` to **enabled**, since Sonar only re-analyzes saved files — without saving, post-apply validation could never pass.

### Install

1. Download `vscode-smellcc-0.0.7.vsix`
2. VS Code → Extensions → "..." → Install from VSIX → Reload Window
3. Command Palette → `SMELLCC: Set API Key (SecretStorage)` (if not set)
