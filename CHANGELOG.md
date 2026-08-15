# Change Log

All notable changes to the "SMELLCC" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.2]

### Changed

- Removed the deprecated plaintext `smellcc.apiKey` setting from the Settings UI entirely. The API key now exists only in VS Code SecretStorage; there is no Api Key field in Settings anymore. Legacy plaintext values are still read once and migrated (then cleared).

## [0.1.1]

### Added

- First-run onboarding: on activation without a configured API key, SMELLCC automatically prompts for the key (stored in SecretStorage) and offers to keep the DeepSeek official base URL (`https://api.deepseek.com`) or enter a custom OpenAI-compatible endpoint. The prompt shows at most once per window.

## [0.1.0]

### Added

- Branded diagnostics are back by default: SMELLCC mirrors supported Sonar findings as `[SMELLCC]` entries in the Problems panel (setting `smellcc.mirrorDiagnostics`). Quick fixes attach to both SMELLCC's own diagnostics and Sonar's originals, so the lightbulb works in either mode.
- Fingerprint-based re-sync after Apply: the mirrored diagnostics stay cleared until Sonar's diagnostics actually change (re-analysis completed), with an 8-second fallback — no ghost or disappearing entries.

### Changed

- README documents how to show only SMELLCC entries: VS Code cannot hide another extension's diagnostics, so use the Problems panel filter `!sonarqube` to hide Sonar's raw entries.

## [0.0.9]

### Changed

- Removed the diagnostic mirror layer entirely: SMELLCC no longer creates its own `[SMELLCC]` diagnostics in the Problems panel. Quick fixes now attach directly to Sonar's own warnings, so only one set of diagnostics is displayed.
- The CodeAction provider accepts any Sonar-sourced diagnostic (SonarQube for IDE / SonarLint / SonarQube) whose rule is in the supported mapping.

### Fixed

- Removes the entire stale-mirror bug class: ghost diagnostics after Apply, disappearing `[SMELLCC]` entries, and the sync/suppression timing issues are structurally impossible without the mirror.

## [0.0.8]

### Fixed

- Closed the remaining ghost-diagnostic window: after Apply, the refactored document is suppressed from mirror sync until Sonar actually emits its post-re-analysis diagnostics event (8 s fallback). A save immediately after Apply can no longer re-attach Sonar's stale pre-edit diagnostics to the shifted lines.

## [0.0.7]

### Fixed

- Stale mirrored diagnostics after Apply: SMELLCC now clears its mirror for the refactored document immediately after the edit lands and re-syncs once Sonar finishes its async re-analysis. This removes the "already fixed, but still highlighted with a weird range" ghost diagnostics.
- `Smellcc: Auto Save After Apply` now defaults to enabled, because Sonar only re-analyzes saved files — without saving, post-apply validation could never pass.

## [0.0.6]

### Added

- API key now stored in VS Code SecretStorage via `SMELLCC: Set API Key` command; legacy plaintext setting is migrated automatically on activation.
- First-run refactor prompts for the API key when none is set.
- Undo entry points: History view toolbar button and per-entry context-menu undo.

### Fixed

- Undo hardened: EOL-normalized stale-source checks (CRLF files no longer trigger false "source changed" refusals), auto-save after undo when the file had been saved, and the "already reverted externally" case now clears the undo entry instead of refusing.
- Out-of-order undo now offers to undo the newest refactor instead of just failing.

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
