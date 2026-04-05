// Completed tasks for the current goal.
// Format: [x] <timestamp> <task>

[x] 2026-04-05T16:32:59Z Wrote the implementation plan and scaffolded the project files for the TODO CLI.
[x] 2026-04-05T16:41:49Z Implemented TODO and TODO_COMPLETED parsing, validation, and file write flows.
[x] 2026-04-05T16:41:49Z Implemented CLI commands to browse tasks, add tasks, remove tasks, mark tasks complete, and reprioritize tasks.
[x] 2026-04-05T16:41:49Z Implemented Ollama-powered task expansion using `ollama run nemotron-3-nano:4b-128k`, limited to editing TODO.md.
[x] 2026-04-05T16:41:49Z Added automated tests that prove the requested CLI behavior and markdown linting rules.
[x] 2026-04-05T16:41:49Z Ran verification, moved completed work into TODO_COMPLETED.md, and left only unfinished work in TODO.md.
[x] 2026-04-05T16:44:54Z Exposed the CLI binary as `todoer-cli` while preserving the existing local command behavior.
[x] 2026-04-05T16:44:54Z Added an easy shell installer that installs dependencies and links the CLI for terminal use.
[x] 2026-04-05T16:44:54Z Verified the installer flow and moved the completed tasks into TODO_COMPLETED.md.
[x] 2026-04-05T17:06:25Z Replaced the one-shot `commander` CLI with a TUI-first `todoer-cli` entrypoint and migration errors for removed subcommands.
[x] 2026-04-05T17:06:25Z Implemented the full-screen terminal UI with task views, file navigation, inline editing, strict dirty-buffer handling, and recovery mode.
[x] 2026-04-05T17:06:25Z Converted task expansion to a non-blocking TUI flow and preserved strict markdown validation on writes.
[x] 2026-04-05T17:06:25Z Replaced subprocess command tests with PTY-driven interactive acceptance tests and kept direct task-layer coverage.
[x] 2026-04-05T17:06:25Z Verified install, lint, tests, and TUI launch behavior, then moved the completed work into TODO_COMPLETED.md.
[x] 2026-04-05T18:19:30Z Simplified the TUI so the menu only exposes TODO.md, TODO_COMPLETED.md, and an AI features ON/OFF toggle.
[x] 2026-04-05T18:19:30Z Enforced that TODO_COMPLETED.md remains preview-only and cannot enter edit mode.
[x] 2026-04-05T18:19:30Z Made Ctrl+K open the add-task modal and persist new tasks into TODO.md from inside the TUI.
[x] 2026-04-05T18:19:30Z Verified the simplified UX with linting and PTY interaction tests, then cleared TODO.md for the goal.
[x] 2026-04-05T18:38:40Z Reworked the TUI around visible sidebar actions, persistent shortcut help, and simpler direct flows for add, reprioritize, done, reload, and quit.
[x] 2026-04-05T18:38:40Z Simplified reprioritization to selecting a task and entering only the new priority number, while keeping TODO_COMPLETED.md read-only.
[x] 2026-04-05T18:38:40Z Fixed the editor interaction so Ctrl+S saves from inside the textarea and Esc leaves editor focus like a nano-style workflow.
[x] 2026-04-05T18:38:40Z Verified the redesigned easier TUI with linting and PTY acceptance tests, then left TODO.md empty for the goal.
[x] 2026-04-05T19:31:30Z Replaced the action-heavy TUI with a nano-like single-editor workflow that opens TODO.md directly and switches to read-only TODO_COMPLETED.md with Ctrl+P.
[x] 2026-04-05T19:31:30Z Auto-created missing TODO.md and TODO_COMPLETED.md files with the required comment headers, rules, and shortcut comments.
[x] 2026-04-05T19:31:30Z Implemented Ctrl+J new-task insertion, Ctrl+L AI line expansion, automatic renumbering/reordering, and external file auto-reload for the nano-like editor.
[x] 2026-04-05T19:31:30Z Rewrote the PTY acceptance tests for the nano-like workflow, verified lint and tests, and cleared TODO.md for the goal.
[x] 2026-04-05T20:04:20Z Removed shortcut and priority guidance from TODO.md headers so only Current goal, Rule, and Format remain.
[x] 2026-04-05T20:04:20Z Removed the AI feature and its Ctrl+L behavior from the nano-like editor.
[x] 2026-04-05T20:04:20Z Added clean terminal resize handling and Ctrl+C exit behavior to the TUI.
[x] 2026-04-05T20:04:20Z Updated PTY coverage for the minimal-header, no-AI, resize-safe, Ctrl+C-exit workflow, then cleared TODO.md for the goal.
[x] 2026-04-05T20:10:36Z Fixed the nano-like TUI footer so shortcut hints stay visible on narrow terminal sizes.
[x] 2026-04-05T20:10:36Z Made TODO task rendering wrap-aware so the active edit position tracks the correct on-screen row after resize.
[x] 2026-04-05T19:18:13Z Made the active TODO typing position explicit with an inline cursor marker instead of relying on the terminal cursor alone.
[x] 2026-04-05T19:18:13Z Blocked unassigned Ctrl-key combinations from falling through into text insertion and added PTY regression coverage for it.
