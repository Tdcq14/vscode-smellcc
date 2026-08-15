# SMELLCC: LLM-based Code Smell Refactoring

This VS Code extension is an implementation of the prototype system described in the TOSEM paper: **"Clean Code, Better Models: Enhancing LLM Performance with Smell-Cleaned Dataset"**.

It leverages Large Language Models (LLM) to refactor the **Top-10** frequent code smells in Python codebases detected by **SonarLint**, while keeping the developer in control of every generated change.

## ✨ Features

* **🔌 SonarLint Integration**: Uses Sonar diagnostics as the trigger and target signal for supported smell rules.
* **🧭 Symbol-aware Scope Selection**: Prefers VS Code document symbols to locate the smallest enclosing function/method, with an indentation-based fallback.
* **🤖 Smell-specific LLM Refactoring**: Builds a prompt from the smell type, exact diagnostic location, target line and enclosing code context.
* **🔀 Review-before-Apply Diff**: Opens the complete before/after proposal in VS Code's native diff editor before the working file is modified.
* **🛡️ Change Risk Guard**: Computes line-level edit statistics and flags unexpectedly broad changes, large deletions or suspicious signature edits before Apply.
* **🐍 Pre-apply Syntax Gate**: Validates the proposed full Python document with `py_compile` when a Python interpreter is available; syntactically invalid proposals are blocked.
* **✅ Post-apply Sonar Validation**: Watches refreshed Sonar diagnostics and checks whether the target rule decreased inside the modified scope.
* **↩️ Guarded Undo**: Rolls back only when the AI-generated region has not been changed afterwards, protecting later developer edits.
* **🕘 Refactor History View**: Records accepted/rejected/undone proposals, risk level, changed-line counts and validation result in an Explorer Tree View for the current session.

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

## 🔁 Reviewable and Verifiable Refactoring Workflow

SMELLCC no longer treats an LLM response as an edit that should be blindly committed to the workspace.

```text
Sonar diagnostic
      ↓
Symbol-aware localization
      ↓
Smell-specific LLM proposal
      ↓
Change-risk analysis + Python syntax gate
      ↓
VS Code native Diff Review
   ↙                    ↘
Reject                  Apply
(no mutation)             ↓
                      stale-source check
                           ↓
                      WorkspaceEdit
                           ↓
                  Sonar post-validation
                    ↙       ↓        ↘
                 passed   failed   inconclusive
                           ↓
                     keep / safe undo
                           ↓
                  Session History View
```

### Why a plugin-level diff if the project already uses Git?

Git remains the repository-level source of truth for history, commits and code review. SMELLCC's diff solves a different problem: it creates a **proposal-level decision point before the AI touches the working file**. The developer sees exactly what this single refactoring request intends to change, without mixing it with unrelated uncommitted workspace edits.

### Risk guard

Before Apply, SMELLCC compares the original and proposed scope with a line-level LCS calculation and reports metrics such as `+added/-removed` lines and an overall risk level. Examples of high-risk signals include:

* unexpectedly changing a function signature for a smell that should not require it;
* modifying a large fraction of the enclosing scope;
* deleting a large fraction of the original function;
* turning a small quick fix into a very large edit.

High-risk proposals are still inspectable in the native diff, but require a stronger explicit confirmation.

### Validation loop

When possible, the proposed full Python document is syntax-checked **before Apply**. After Apply, SMELLCC waits for Sonar diagnostics to refresh and compares the target rule count in the changed scope. Validation can be:

* **passed** — the target rule decreased;
* **failed** — Sonar refreshed but the target rule remained;
* **inconclusive** — Sonar did not refresh before the configured timeout.

A failed validation can immediately trigger the guarded SMELLCC undo.

### Refactor history

Open **Explorer → SMELLCC Refactor History** to inspect the current session. Each row records the smell, file, decision, risk level, changed-line counts, syntax result and Sonar validation status. This is intended both for developer traceability and for future empirical evaluation of acceptance/rejection and validation outcomes.

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
5. **Optional**: Change `Smellcc: Model` (default: `deepseek-coder`).
6. **Optional**: Enable `Smellcc: Auto Save After Apply` to save an explicitly accepted edit immediately.
7. **Optional**: Disable `Smellcc: Validate After Apply` if you do not want SMELLCC to wait for Sonar post-validation.
8. **Optional**: Adjust `Smellcc: Validation Timeout Ms` (default: 5000 ms).

---

## 🚀 Usage Guide

1. Open a Python (`.py`) file.
2. Wait for SonarLint to analyze the file.
3. Click the lightbulb on a supported smell and select **"Refactor: [Smell Name] (SMELLCC)"**.
4. SMELLCC generates a proposal, evaluates its risk and checks Python syntax when possible.
5. Inspect the native red/green diff.
6. Choose **Apply Refactor** / **Apply High-Risk Refactor** or **Reject**.
7. If applied, inspect the post-apply Sonar validation result.
8. Use **SMELLCC: Undo Last Refactor** if needed.
9. Review the session in **Explorer → SMELLCC Refactor History**.

---

## 📋 Requirements

* **VS Code**: version 1.106.0 or higher.
* **SonarLint Extension**: Must be installed and active.
* **Java Runtime (JRE)**: Version 17 or higher (required by SonarLint).
* **Python interpreter**: Recommended for the pre-apply syntax gate. If unavailable, review can continue but syntax validation is marked unavailable.
* **Internet Connection**: Required to access the configured LLM API.

## 🔗 References

* **Paper**: *Clean Code, Better Models: Enhancing LLM Performance with Smell-Cleaned Dataset*.
* **Prototype**: SMELLCC Tool.
