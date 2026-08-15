## SMELLCC v0.0.8

### Fixed: ghost diagnostic window after Apply (follow-up to 0.0.7)

Scenario: SonarQube flags a nested `if` (S1066) → SMELLCC mirrors it → you Apply the merge fix.

v0.0.7 cleared the mirror at Apply time, but a save immediately after Apply could still re-attach Sonar's *pre-edit* diagnostics (Sonar re-analyzes asynchronously), so the "already fixed, but still highlighted" ghost could reappear for a few seconds.

v0.0.8 closes that window: after Apply, the refactored document is **suppressed** from mirror sync until Sonar actually emits its post-re-analysis diagnostics event (with an 8-second fallback). No more stale squiggles on shifted lines.

### Install

1. Download `vscode-smellcc-0.0.8.vsix`
2. VS Code → Extensions → "..." → Install from VSIX → Reload Window
3. Command Palette → `SMELLCC: Set API Key (SecretStorage)` (if not set)
