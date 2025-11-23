# SMELLCC: LLM-based Code Smell Refactoring

This VS Code extension is an implementation of the prototype system described in the TOSEM paper: **"Clean Code, Better Models: Enhancing LLM Performance with Smell-Cleaned Dataset"**.

It leverages Large Language Models (LLM) to automatically refactor the **Top-10** most frequent code smells in Python codebases detected by **SonarLint**.

## ✨ Features

* **🔌 Seamless Integration**: Works directly on top of **SonarLint**'s powerful detection engine. No extra server setup required.
* **🔍 Automatic Detection**: Real-time detection of 10 types of code smells (e.g., Long Parameter List, Collapsible If, Dead Code) via SonarLint.
* **🤖 AI-Powered Refactoring**: Utilizes **Chain-of-Thought (CoT)** prompting strategies to generate high-quality, context-aware fixes using LLMs (DeepSeek/OpenAI).
* **💡 Quick Fix Integration**: Integrated natively with VS Code's "Lightbulb" interface for one-click refactoring.

### Supported Code Smells
1.  Collapsible if Statements
2.  Long Parameter List
3.  Naming Convention (Class, Function, Variable, Method)
4.  Commented Code
5.  Empty Nested Code Blocks
6.  Dead Code
7.  Self-assigned Variables
8.  Identical Expressions
9.  Return and Yield
10. High Cognitive Complexity

---

## 📥 Installation

1.  **Install SonarLint**: This extension requires the [SonarLint](https://marketplace.visualstudio.com/items?itemName=SonarSource.sonarlint-vscode) extension to be installed and active.
    * *Note: SonarLint requires a Java Runtime Environment (JRE 17+) to run.*
2.  **Install SMELLCC**:
    * Download the latest `vscode-smellcc-0.0.2.vsix` file from our [GitHub Releases](#).
    * In VS Code, go to the **Extensions** view (`Ctrl+Shift+X`).
    * Click the **"..."** menu (top-right) -> **"Install from VSIX..."**.
    * Select the downloaded file.

---

## ⚙️ Configuration (Required)

To enable AI refactoring, you must configure your LLM provider.

1.  Open VS Code Settings (`Ctrl + ,` or `Cmd + ,`).
2.  Search for **`smellcc`**.
3.  **Required**: Enter your API Key in **`Smellcc: Api Key`**.
4.  **Optional**: Configure the **`Smellcc: Api Base Url`**.
    * Default: `https://api.deepseek.com` (DeepSeek Official)
    * For **ChatAnywhere** or proxies: `https://api.chatanywhere.tech/v1`
    * For **OpenAI**: `https://api.openai.com/v1`
5.  **Optional**: Change the **`Smellcc: Model`** (Default: `deepseek-coder`).

---

## 🚀 Usage Guide

1.  Open any **Python** (`.py`) file.
2.  Wait for **SonarLint** to analyze the file (usually takes a few seconds).
3.  If a supported code smell is detected, you will see a **Yellow Warning Squiggly Line**.
4.  Hover over the code to see the diagnostic message (prefixed with `[SMELLCC]`).
5.  Click the **Lightbulb icon 💡** (or press `Ctrl + .`).
6.  Select **"Refactor: [Smell Name] (SMELLCC)"**.
7.  Wait for the progress notification. The extension will automatically fetch the context and refactor the code!

---

## 📋 Requirements

* **VS Code**: version 1.80.0 or higher.
* **SonarLint Extension**: Must be installed and active.
* **Java Runtime (JRE)**: Version 17 or higher (Required by SonarLint).
* **Internet Connection**: To access the LLM API.

## 🔗 References

* **Paper**: *Clean Code, Better Models: Enhancing LLM Performance with Smell-Cleaned Dataset*.
* **Prototype**: SMELLCC Tool.

---

**Enjoy writing Clean Code!**