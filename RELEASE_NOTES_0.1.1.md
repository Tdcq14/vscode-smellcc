## SMELLCC v0.1.1

### First-run onboarding: key + URL, zero friction

- Install → Reload → SMELLCC automatically prompts for the API key if none is configured (once per window).
- Key is stored in **VS Code SecretStorage** — never plaintext.
- After the key, SMELLCC asks for the base URL: keep the **DeepSeek official default** (`https://api.deepseek.com`) or enter any custom OpenAI-compatible endpoint.
- Model defaults to `deepseek-chat`; change it in Settings anytime.
- If you skip onboarding, triggering a quick fix will ask for the key again; `SMELLCC: Set API Key` is always available.

### Install

1. Download `vscode-smellcc-0.1.1.vsix`
2. VS Code → Extensions → "..." → Install from VSIX → Reload Window
3. Follow the automatic setup prompt (or run `SMELLCC: Set API Key`)
