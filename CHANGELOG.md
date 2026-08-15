# Change Log

All notable changes to the "SMELLCC" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.5]

### Fixed

- Initial diagnostics sync race: SMELLCC now mirrors Sonar diagnostics immediately at activation (with delayed retries for the async Sonar language server), on active-editor switches, and per changed URI. Quick fixes now appear without requiring a manual save or reopen.

## [0.0.4]

### Added

- Review-before-Apply diff: native VS Code diff editor shows the full before/after proposal before any mutation.
- Apply / Reject decision flow with change-risk escalation for high-risk proposals.
- Guarded Undo: refuses to roll back when the developer has edited the refactored region afterwards.
- Symbol-aware scope selection (document symbols with indentation fallback).
- Workspace impact guard via VS Code reference provider for naming / long-parameter smells.
- Change risk analysis (+/- lines, edit ratio, deletion ratio, signature change).
- Pre-apply Python syntax gate (`py_compile`) and LLM completion integrity guard (empty / truncated / timeout responses rejected).
- Post-apply Sonar validation (passed / failed / inconclusive) with safe-undo on failure.
- Refactor History explorer view (apply / reject / undo, risk, syntax, validation).
- Unit tests (`npm test`) and lint (`npm run lint`) wired into the build.

### Changed

- Naming / long-parameter prompts no longer claim to update usages outside the visible snippet.
- Default model changed from `deepseek-coder` to `deepseek-chat`.
- Display name changed to "SMELLCC: LLM Code Smell Refactoring".

## [0.0.3]

- Initial release.
