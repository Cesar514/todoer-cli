// Completed tasks for the current goal. \
// Format: [x] <timestamp> <task> \
// Example: [x] 2026-04-05T20:39:27Z Verify the completed-task log is sorted newest-first using 24-hour HH:MM:SS UTC timestamps. \

[x] 2026-04-05T21:47:02Z Wrote a repository-specific README covering setup, runtime behavior, architecture, task-file storage rules, and the actual command surface of todoer-cli. \
[x] 2026-04-05T21:21:39Z Added bottom viewport padding and TODO scroll clamping so short terminals can still reach the final items in TODO.md and TODO_COMPLETED.md. \
[x] 2026-04-05T21:21:39Z Added wrapped-viewport regression coverage proving short-terminal scroll math still leaves enough room to reach the final TODO rows. \
[x] 2026-04-05T20:39:27Z Expanded the TODO_COMPLETED.md header with a canonical example line so automated rewrites keep the completed-entry format explicit and stable. \
[x] 2026-04-05T20:23:13Z Canonicalized TODO_COMPLETED.md output so parseable completed entries are rewritten in descending timestamp order using 24-hour HH:MM:SS UTC timestamps. \
[x] 2026-04-05T20:23:13Z Added malformed-file recovery that backs up unreformattable TODO.md and TODO_COMPLETED.md to TODO.bak and TODO_COMPLETED.bak before recreating clean canonical task files. \
[x] 2026-04-05T20:16:27Z Replaced mtime-only external-change detection with content-aware conflict checks so harmless same-content rewrites no longer trigger the fatal unsaved-edits warning. \
[x] 2026-04-05T20:16:27Z Added PTY regression coverage proving a metadata-only TODO.md touch while editing does not raise the external-change fatal and still allows saving. \
[x] 2026-04-05T20:13:16Z Added Ctrl+L as a delete-line action in TODO.md with a required yes/no confirmation popup before removal. \
[x] 2026-04-05T20:13:16Z Added PTY regression coverage proving Ctrl+L deletes on "Yes" and leaves the line untouched on "No". \
[x] 2026-04-05T20:10:36Z Fixed the nano-like TUI footer so shortcut hints stay visible on narrow terminal sizes. \
[x] 2026-04-05T20:10:36Z Made TODO task rendering wrap-aware so the active edit position tracks the correct on-screen row after resize. \
[x] 2026-04-05T20:07:43Z Fixed the TUI reorder/save path so large user-assigned priorities such as `14` are preserved instead of being renumbered away. \
[x] 2026-04-05T20:07:43Z Added explicit markdown line-break markers to serialized TODO and completed files so markdown viewers render one item per line instead of collapsing lines together. \
[x] 2026-04-05T20:07:43Z Updated file creation, parsing, and PTY regression coverage so save/reload accepts the markdown line-break format while preserving intended priorities. \
[x] 2026-04-05T20:04:20Z Removed shortcut and priority guidance from TODO.md headers so only Current goal, Rule, and Format remain. \
[x] 2026-04-05T20:04:20Z Removed the AI feature and its Ctrl+L behavior from the nano-like editor. \
[x] 2026-04-05T20:04:20Z Added clean terminal resize handling and Ctrl+C exit behavior to the TUI. \
[x] 2026-04-05T20:04:20Z Updated PTY coverage for the minimal-header, no-AI, resize-safe, Ctrl+C-exit workflow, then cleared TODO.md for the goal. \
[x] 2026-04-05T19:52:33Z Preserved arbitrary large user-assigned priorities so values like `14` stay at the bottom of TODO.md and survive save/reload without collapsing the rest of the numbering. \
[x] 2026-04-05T19:45:12Z Fixed TODO priority edits so valid number changes renumber and reorder tasks immediately in the in-memory editor state instead of only after a later confirmation step. \
[x] 2026-04-05T19:45:12Z Fixed the more-than-9-items save bug by preserving parsed priority numbers when reloading TODO.md, preventing tasks from collapsing into `[] .` entries after save. \
[x] 2026-04-05T19:45:12Z Verified that saved TODO.md content keeps one line per comment and one line per task, and cleared the extra scratch task rows that had been used to reproduce the large-list formatting bug. \
[x] 2026-04-05T19:33:33Z Disabled all unassigned Ctrl-key combinations so they no longer insert junk into TODO.md. \
[x] 2026-04-05T19:33:33Z Made Ctrl+J use the same insertion path as Enter, including PTY linefeed handling. \
[x] 2026-04-05T19:33:33Z Preserved the current task position and scroll state after Ctrl+S instead of jumping back to the top. \
[x] 2026-04-05T19:33:33Z Fixed priority-number deletion so the number actually disappears and can be replaced cleanly. \
[x] 2026-04-05T19:33:33Z Fixed Enter on the first task to insert the new empty task directly underneath instead of effectively appending it lower down. \
[x] 2026-04-05T19:33:33Z Added stable arrow and mouse-wheel scrolling in TODO_COMPLETED.md with clamped scroll state. \
[x] 2026-04-05T19:33:33Z Changed completed-task ordering so newest entries are written at the top and older entries move down. \
[x] 2026-04-05T19:31:30Z Replaced the action-heavy TUI with a nano-like single-editor workflow that opens TODO.md directly and switches to read-only TODO_COMPLETED.md with Ctrl+P. \
[x] 2026-04-05T19:31:30Z Auto-created missing TODO.md and TODO_COMPLETED.md files with the required comment headers, rules, and shortcut comments. \
[x] 2026-04-05T19:31:30Z Implemented Ctrl+J new-task insertion, Ctrl+L AI line expansion, automatic renumbering/reordering, and external file auto-reload for the nano-like editor. \
[x] 2026-04-05T19:31:30Z Rewrote the PTY acceptance tests for the nano-like workflow, verified lint and tests, and cleared TODO.md for the goal. \
[x] 2026-04-05T19:18:13Z Made the active TODO typing position explicit with an inline cursor marker instead of relying on the terminal cursor alone. \
[x] 2026-04-05T19:18:13Z Blocked unassigned Ctrl-key combinations from falling through into text insertion and added PTY regression coverage for it. \
[x] 2026-04-05T18:38:40Z Reworked the TUI around visible sidebar actions, persistent shortcut help, and simpler direct flows for add, reprioritize, done, reload, and quit. \
[x] 2026-04-05T18:38:40Z Simplified reprioritization to selecting a task and entering only the new priority number, while keeping TODO_COMPLETED.md read-only. \
[x] 2026-04-05T18:38:40Z Fixed the editor interaction so Ctrl+S saves from inside the textarea and Esc leaves editor focus like a nano-style workflow. \
[x] 2026-04-05T18:38:40Z Verified the redesigned easier TUI with linting and PTY acceptance tests, then left TODO.md empty for the goal. \
[x] 2026-04-05T18:19:30Z Simplified the TUI so the menu only exposes TODO.md, TODO_COMPLETED.md, and an AI features ON/OFF toggle. \
[x] 2026-04-05T18:19:30Z Enforced that TODO_COMPLETED.md remains preview-only and cannot enter edit mode. \
[x] 2026-04-05T18:19:30Z Made Ctrl+K open the add-task modal and persist new tasks into TODO.md from inside the TUI. \
[x] 2026-04-05T18:19:30Z Verified the simplified UX with linting and PTY interaction tests, then cleared TODO.md for the goal. \
[x] 2026-04-05T17:06:25Z Replaced the one-shot `commander` CLI with a TUI-first `todoer-cli` entrypoint and migration errors for removed subcommands. \
[x] 2026-04-05T17:06:25Z Implemented the full-screen terminal UI with task views, file navigation, inline editing, strict dirty-buffer handling, and recovery mode. \
[x] 2026-04-05T17:06:25Z Converted task expansion to a non-blocking TUI flow and preserved strict markdown validation on writes. \
[x] 2026-04-05T17:06:25Z Replaced subprocess command tests with PTY-driven interactive acceptance tests and kept direct task-layer coverage. \
[x] 2026-04-05T17:06:25Z Verified install, lint, tests, and TUI launch behavior, then moved the completed work into TODO_COMPLETED.md. \
[x] 2026-04-05T16:44:54Z Exposed the CLI binary as `todoer-cli` while preserving the existing local command behavior. \
[x] 2026-04-05T16:44:54Z Added an easy shell installer that installs dependencies and links the CLI for terminal use. \
[x] 2026-04-05T16:44:54Z Verified the installer flow and moved the completed tasks into TODO_COMPLETED.md. \
[x] 2026-04-05T16:41:49Z Implemented TODO and TODO_COMPLETED parsing, validation, and file write flows. \
[x] 2026-04-05T16:41:49Z Implemented CLI commands to browse tasks, add tasks, remove tasks, mark tasks complete, and reprioritize tasks. \
[x] 2026-04-05T16:41:49Z Implemented Ollama-powered task expansion using `ollama run nemotron-3-nano:4b-128k`, limited to editing TODO.md. \
[x] 2026-04-05T16:41:49Z Added automated tests that prove the requested CLI behavior and markdown linting rules. \
[x] 2026-04-05T16:41:49Z Ran verification, moved completed work into TODO_COMPLETED.md, and left only unfinished work in TODO.md. \
[x] 2026-04-05T16:32:59Z Wrote the implementation plan and scaffolded the project files for the TODO CLI. \
