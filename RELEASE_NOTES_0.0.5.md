## SMELLCC v0.0.5

### Fixed

- **Initial diagnostics sync race (the "must press Ctrl+S first" bug).**
  Sonar produces diagnostics before SMELLCC finishes activating, and the old listener setup only handled *future* events — so `[SMELLCC]` diagnostics and the quick-fix lightbulb did not appear until the file was saved or reopened.

  v0.0.5 now:
  - mirrors existing Sonar diagnostics **immediately at activation**;
  - retries at 500 ms / 1.5 s / 4 s to cover the async Sonar language server;
  - re-mirrors on **active editor switch** and per changed URI;
  - dedupes mirror output to avoid self-triggered diagnostic churn.

### Install

1. Download `vscode-smellcc-0.0.5.vsix`
2. VS Code → Extensions → "..." → **Install from VSIX** → **Reload Window**
3. Open a Python file with SonarQube for IDE / SonarLint diagnostics — `[SMELLCC]` quick fixes appear without saving.
