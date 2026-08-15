# SMELLCC: LLM-based Code Smell Refactoring

This VS Code extension is an implementation of the prototype system described in the TOSEM paper: **"Clean Code, Better Models: Enhancing LLM Performance with Smell-Cleaned Dataset"**.

It leverages Large Language Models (LLM) to automatically refactor the **Top-10** most frequent code smells in Python codebases detected by **SonarLint**.

## ✨ Features

* **🔌 Seamless Integration**: Works directly on top of **SonarLint**'s detection engine. No extra server setup required.
* **🔍 Automatic Detection**: Real-time detection of 10 types of code smells (e.g., Long Parameter List, Collapsible If, Dead Code) via SonarLint.
* **🤖 AI-Powered Refactoring**: Utilizes Chain-of-Thought prompting strategies to generate context-aware fixes using LLMs (DeepSeek/OpenAI-compatible APIs).
* **💡 Quick Fix Integration**: Integrated natively with VS Code's lightbulb interface.
* **🔀 Review-before-Apply Diff**: Every generated refactor is opened in VS Code's native diff editor before source code is modified. Developers can inspect changed lines and explicitly apply or reject the proposal.
* **↩️ Safe Undo**: SMELLCC keeps a bounded refactoring history and can undo the most recent applied change only when the generated region has not been edited afterwards, avoiding accidental overwrite of developer work.
* **🧭 Symbol-aware Scope Selection**: SMELLCC prefers VS Code document symbols to locate the smallest enclosing function/method, with an indentation-based fallback for resilience.

### Supported Code Smells
1. Collapsible if Statements
2. Long Parameter List
3. Naming Convention (Class, Function, Variable, Method)
4. Commented Code
5. Empty Nested Code Blocks
6. Dead Code
7. Self-assigned Variables
8. Identical Expressions
9. Return and Yield
10. High Cognitive Complexity

---

## 🔀 Reviewable Refactoring Workflow

SMELLCC now uses a human-in-the-loop workflow instead of immediately overwriting the source file:

```text
SonarLint diagnostic
      ↓
SMELLCC Quick Fix
      ↓
Symbol-aware context extraction
      ↓
LLM refactoring proposal
      ↓
VS Code native Diff Review
   ↙               ↘
Reject             Apply
(no mutation)      ↓
              WorkspaceEdit
                   ↓
              Safe Undo history
```

The diff preview uses read-only virtual documents, so the proposal can be reviewed before the working file is touched. This complements Git rather than replacing it: Git remains useful for repository-level history and review, while SMELLCC provides an immediate **pre-apply decision point** inside the refactoring interaction.

After reviewing the red/green changed lines, choose **Apply Refactor** or **Reject**. Applied changes are left unsaved by default so the developer retains normal editor control. Set `smellcc.autoSaveAfterApply` to `true` if automatic saving is preferred.

The command **SMELLCC: Undo Last Refactor** provides a plugin-level guarded undo. If the developer has already modified the generated region, SMELLCC refuses the undo rather than overwriting those newer edits.

---

## 📥 Installation

1. **Install SonarLint**: This extension requires the SonarLint extension to be installed and active.
   * SonarLint requires a Java Runtime Environment (JRE 17+).
2. **Install SMELLCC**:
   * Download the latest `.vsix` file from the project release.
   * In VS Code, go to the **Extensions** view (`Ctrl+Shift+X`).
   * Click the **"..."** menu -> **"Install from VSIX..."**.
   * Select the downloaded file.

---

## ⚙️ Configuration

1. Open VS Code Settings (`Ctrl + ,` or `Cmd + ,`).
2. Search for **`smellcc`**.
3. **Required**: Enter your API key in `Smellcc: Api Key`.
4. **Optional**: Configure `Smellcc: Api Base Url`.
   * Default: `https://api.deepseek.com`
   * OpenAI-compatible proxies can also be used.
5. **Optional**: Change `Smellcc: Model` (default: `deepseek-coder`).
6. **Optional**: Enable `Smellcc: Auto Save After Apply` if you want reviewed changes to be saved immediately after application.

---

## 🚀 Usage Guide

1. Open a Python (`.py`) file.
2. Wait for SonarLint to analyze the file.
3. If a supported code smell is detected, a warning diagnostic is mirrored by SMELLCC.
4. Click the lightbulb icon (or press `Ctrl + .`).
5. Select **"Refactor: [Smell Name] (SMELLCC)"**.
6. SMELLCC asks the LLM for a refactoring proposal and opens a native VS Code diff.
7. Inspect the changed lines and select **Apply Refactor** or **Reject**.
8. If needed, run **SMELLCC: Undo Last Refactor** from the Command Palette.

---

## 📋 Requirements

* **VS Code**: version 1.106.0 or higher.
* **SonarLint Extension**: Must be installed and active.
* **Java Runtime (JRE)**: Version 17 or higher (required by SonarLint).
* **Internet Connection**: Required to access the configured LLM API.

## 🔗 References

* **Paper**: *Clean Code, Better Models: Enhancing LLM Performance with Smell-Cleaned Dataset*.
* **Prototype**: SMELLCC Tool.
