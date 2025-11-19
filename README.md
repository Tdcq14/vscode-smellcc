# SMELLCC: LLM-based Code Smell Refactoring

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

This VS Code extension is an implementation of the prototype system described in the TOSEM paper: **"Clean Code, Better Models: Enhancing LLM Performance with Smell-Cleaned Dataset"**.

It leverages Large Language Models (LLM) to automatically detect and refactor the **Top-10** most frequent code smells in Python codebases.

## ✨ Features

* **🔍 Automatic Detection**: Real-time detection of 10 types of code smells (e.g., Long Parameter List, Collapsible If, Dead Code).
* **🤖 AI-Powered Refactoring**: Utilizes **Chain-of-Thought (CoT)** prompting strategies to generate high-quality, context-aware fixes.
* **💡 Quick Fix Integration**: Seamlessly integrated with VS Code's native "Lightbulb" interface.

### Supported Code Smells
1.  Collapsible if Statements
2.  Long Parameter List
3.  Naming Convention
4.  Commented Code
5.  Empty Nested Code Blocks
6.  Dead Code
7.  Self-assigned Variables
8.  Identical Expressions
9.  Return and Yield
10. High Cognitive Complexity

---

## 📥 Installation

Since this extension is currently in the prototype stage, please install it manually using the `.vsix` package:

1.  Download the latest `vscode-smellcc-0.0.1.vsix` file from our [GitHub Releases](#).
2.  Open **VS Code**.
3.  Go to the **Extensions** view (Click the square icon on the left sidebar or press `Ctrl+Shift+X`).
4.  Click the **"..." (Views and More Actions)** menu at the top-right of the Extensions view.
5.  Select **"Install from VSIX..."**.
6.  Choose the downloaded `.vsix` file.

---

## ⚙️ Configuration (Required)

To use the AI refactoring capabilities, you must configure your LLM API Key.

1.  Open VS Code Settings:
    * **Windows/Linux**: `File` > `Preferences` > `Settings` (or press `Ctrl + ,`).
    * **macOS**: `Code` > `Settings` > `Settings` (or press `Cmd + ,`).
2.  Search for **`smellcc`** in the search bar.
3.  Enter your API Key in the **`Smellcc: Api Key`** field.
    * *Note: The default endpoint is compatible with DeepSeek/OpenAI interfaces.*
4.  (Optional) Change the **`Smellcc: Model`** if needed (Default: `deepseek-v3`).

---

## 🚀 Usage Guide

1.  Open any **Python** (`.py`) file.
2.  If the extension detects a code smell, you will see a **Yellow/Warning Squiggly Line** under the code.
3.  Hover over the code or click on it.
4.  Click the **Lightbulb icon 💡** (or press `Ctrl + .` / `Cmd + .`).
5.  Select **"Fix with SMELLCC (AI Refactor)"**.
6.  Wait for the progress bar to finish. The code will be automatically refactored!

---

## 📋 Requirements

* VS Code version 1.80.0 or higher.
* Active Internet connection (to access the LLM API).

## 🔗 References

* **Paper**: *Clean Code, Better Models: Enhancing LLM Performance with Smell-Cleaned Dataset* (TOSEM).
* **Prototype**: SMELLCC Tool.

---

**Enjoy writing Clean Code!**