## SMELLCC v0.0.6

### Security: API key moved to SecretStorage

- New command **`SMELLCC: Set API Key (SecretStorage)`** — the key is stored in VS Code SecretStorage, never in plaintext settings.
- Legacy plaintext `smellcc.apiKey` values are migrated to SecretStorage and cleared automatically on activation.
- If you run a quick fix with no key configured, SMELLCC now prompts for it directly.
- Default provider unchanged: DeepSeek (`https://api.deepseek.com`, model `deepseek-chat`). Key: https://platform.deepseek.com

### Undo improvements

- **More entry points**: toolbar Undo button in the SMELLCC Refactor History view, and right-click → "Undo This Refactor" on applied entries (plus the existing apply-notification button and `SMELLCC: Undo Last Refactor`).
- **CRLF fix**: stale-source checks now normalize line endings, so Windows CRLF files no longer falsely refuse Apply/Undo with "source changed".
- **Saved-file undo**: if the file had been saved after Apply, Undo now also writes the reverted content back to disk.
- **Already-reverted case**: if the region was reverted externally (e.g. `git checkout`), undo now clears the entry instead of refusing.
- **Out-of-order undo**: now offers "Undo Newest Refactor" instead of just failing.

### Install

1. Download `vscode-smellcc-0.0.6.vsix`
2. VS Code → Extensions → "..." → Install from VSIX → Reload Window
3. Command Palette → `SMELLCC: Set API Key (SecretStorage)`
