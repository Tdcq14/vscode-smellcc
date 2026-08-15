## SMELLCC v0.1.0

### SMELLCC diagnostics are back — and this time they are stable

- **Branded display (default)**: supported Sonar findings are mirrored as `[SMELLCC] Naming - Function: ...` entries in the Problems panel, so the tool is visible as its own product. Setting: `Smellcc: Mirror Diagnostics`.
- **Lightbulb works everywhere**: quick fixes attach to both the `[SMELLCC]` diagnostics and Sonar's original ones (so the fix is available even with mirroring disabled).
- **No more ghosts / disappearing entries**: after Apply, mirrored diagnostics stay cleared until Sonar's diagnostics actually change (re-analysis done), verified via a diagnostic fingerprint, with an 8-second fallback.

### Show only SMELLCC entries (hide Sonar's raw ones)

VS Code does not allow one extension to hide another extension's diagnostics. To see only the `[SMELLCC]` entries:

1. Open the **Problems** panel.
2. In the filter box type: `!sonarqube`

Sonar's raw entries disappear; SMELLCC's remain.

### Install

1. Download `vscode-smellcc-0.1.0.vsix`
2. VS Code → Extensions → "..." → Install from VSIX → Reload Window
3. Command Palette → `SMELLCC: Set API Key (SecretStorage)` (if not set)
