# Implement The Greenfield TODO CLI

This ExecPlan must be maintained in accordance with `/home/cesar514/.codex/.agent/PLANS.md`. The repository currently contains only the original feature request in `TODO.md`, so the work in this plan both defines the project structure and implements the entire requested command-line interface. After this change, a user will be able to manage `TODO.md` and `TODO_COMPLETED.md` from the terminal, reprioritize pending work, validate markdown formatting, and expand a pending task through a local Ollama model. The result is visible by running the CLI against a sample task file and observing the markdown files update deterministically.

## Progress

- [x] (2026-04-05T16:32:59Z) Read the repository instructions, inspected the existing task list, and confirmed the repo is a greenfield project.
- [x] (2026-04-05T16:32:59Z) Wrote this ExecPlan and replaced the repo TODO tracking files with goal-specific implementation tasks.
- [x] (2026-04-05T16:41:49Z) Scaffolded the Node project with `package.json`, `package-lock.json`, `pixi.toml`, source modules, and a test directory.
- [x] (2026-04-05T16:41:49Z) Implemented markdown parsing, validation, write helpers, and CLI commands for list, add, remove, done, reprioritize, expand, and lint.
- [x] (2026-04-05T16:41:49Z) Implemented Ollama task expansion with hard-failure behavior and a 300-word cap.
- [x] (2026-04-05T16:41:49Z) Added automated tests covering task management, linting, reprioritization, completion flow, and expansion integration boundaries.
- [x] (2026-04-05T16:41:49Z) Ran the full verification suite, updated TODO tracking, and recorded final outcomes.
- [x] (2026-04-05T17:06:25Z) Replaced the one-shot subcommand CLI with a full-screen `todoer-cli` TUI and migration errors for removed top-level commands.
- [x] (2026-04-05T17:06:25Z) Added inline markdown editing, recovery mode, async Ollama expansion, and PTY-based interactive tests.
- [x] (2026-04-05T17:06:25Z) Re-ran install, lint, and the complete PTY-backed test suite after the TUI refactor.

## Surprises & Discoveries

- Observation: The repository has no source files, no package metadata, and no git `HEAD`, so the implementation must bootstrap the entire project rather than modify an existing codebase.
  Evidence: `rg --files -uu` returned only `TODO.md` and `.scplus/state/index.sqlite`, and `scplus` status reported `fatal: bad revision 'HEAD'`.

## Decision Log

- Decision: Use Node.js with a small CommonJS CLI stack (`commander`) instead of TypeScript.
  Rationale: The repo is empty, Node is already available, and the requested behavior is file- and process-oriented rather than type-heavy. This keeps the implementation small and directly executable.
  Date/Author: 2026-04-05 / Codex

- Decision: Introduce `pixi.toml` alongside `package.json`.
  Rationale: Repo instructions require Pixi for new projects without existing environment setup, while JavaScript still benefits from the native npm ecosystem for dependency installation and script execution.
  Date/Author: 2026-04-05 / Codex

- Decision: Normalize pending task numbering after delete, complete, and reprioritize operations.
  Rationale: The original task list defines priority by the numeric prefix and requires serial execution with unique numbers. Renumbering remaining pending tasks keeps the file consistent and removes ambiguity.
  Date/Author: 2026-04-05 / Codex

- Decision: Replace the `commander` command surface with a `neo-blessed` full-screen TUI and keep explicit typed commands inside the interface.
  Rationale: The user’s stated goal shifted from one-shot shell commands to a persistent terminal application where all task work stays inside one session.
  Date/Author: 2026-04-05 / Codex

## Outcomes & Retrospective

The repository now contains a working full-screen terminal UI launched by `todoer-cli`. Users can stay inside the interface to browse tasks, edit `TODO.md` and `TODO_COMPLETED.md`, run explicit task commands, recover from invalid markdown, and invoke Ollama-backed expansion without falling back to top-level subcommands. The remaining operational dependency is still Ollama itself, which must be installed locally with the expected model available.

## Context and Orientation

The repository root is `/home/cesar514/Documents/agent_programming/todoer-cli`. At the start of work, the only meaningful project file was `TODO.md`, containing the product requirements in an informal task format. The CLI to be built in this plan will manage two markdown files:

- `TODO.md` for pending tasks, using one task per line in the format `[] 1. Task text`.
- `TODO_COMPLETED.md` for completed tasks, using one task per line in a timestamped completed format that the CLI itself will define and validate.

The source code will live under `src/`. The parser layer will be responsible for reading markdown task files, validating strict formatting rules, and converting them into in-memory task objects. The command layer will be responsible for mutations such as add, remove, reprioritize, complete, and expand. “Expand” means sending one pending task to the local Ollama command `ollama run nemotron-3-nano:4b-128k`, asking the model to rewrite that one task to a maximum of 300 words, and then writing the result back to `TODO.md`. Because the repository instructions require hard failures, missing files, malformed tasks, missing binaries, duplicate priorities, and failed model calls must all throw explicit errors.

## Plan of Work

First, create the project skeleton: `package.json`, `package-lock.json`, `pixi.toml`, `src/`, and `test/`. The package scripts will expose the CLI, lint command, and test suite. The Pixi file will pin the runtime commands used for local execution.

Next, implement the parser and storage helpers in dedicated source modules. One module will define the task-file formats, parse lines, enforce unique ascending priorities, and serialize tasks back to markdown. A second module will provide high-level operations such as add, remove, reprioritize, mark complete, and write both markdown files atomically from the command’s point of view.

Then implement the CLI entry point. It should launch a full-screen terminal UI by default, allow `--root`, `--help`, and `--version`, and reject the old subcommands with a migration error. Inside the TUI, explicit typed commands should cover list, completed, add, remove, done, reprioritize, expand, open todo, open completed, write, reload, discard, help, and quit.

After command implementation, add tests that create temporary repositories, execute the CLI as a subprocess, and assert on the exact markdown file contents. The tests must demonstrate the requested behaviors directly, not only internal helpers.

Finally, run the verification commands, move every completed implementation step from `TODO.md` into `TODO_COMPLETED.md`, and update this ExecPlan with the final evidence.

## Concrete Steps

Run the following from `/home/cesar514/Documents/agent_programming/todoer-cli`:

    npm install
    ./install.sh
    npm test
    npm run lint
    todoer-cli --help

Expected verification signs:

    `npm test` reports all tests passing, including PTY-driven TUI scenarios.
    `npm run lint` prints a success message when both markdown files match the required formats.
    `todoer-cli --help` prints the TUI-oriented usage text.

Observed final verification:

    ./install.sh
    npm test
    npm run lint
    todoer-cli --help

    Install complete.
    Test Files  2 passed (2)
    Tests  12 passed (12)
    TODO.md and TODO_COMPLETED.md are valid.
    Launch the full-screen TUI and use in-app commands there.

## Validation and Acceptance

Acceptance requires direct proof of the user-visible behavior. The strongest proof is PTY-based tests that launch the full-screen TUI, send keystrokes, and compare both terminal output and resulting file contents. The suite must cover:

- launching the TUI into the pending-task view,
- adding, completing, and reprioritizing tasks from inside the UI,
- inline editing with `Ctrl+S`,
- failed writes that leave on-disk files unchanged,
- recovery mode and reload behavior for invalid markdown,
- expanding a task by invoking Ollama through a controlled test double while ensuring only `TODO.md` changes,
- migration errors for removed top-level subcommands,
- `--root` loading an alternate workspace.

Manual verification should also run `./install.sh`, `npm run lint`, and `todoer-cli --help` in the repository root after the final task-file rewrite.

## Idempotence and Recovery

Most commands are repeatable when the input files stay valid. `lint` and `list` are read-only. `add`, `remove`, `reprioritize`, `done`, and `expand` mutate markdown files deterministically and can be re-run if the prior invocation failed before writing. If a mutation writes an undesired state, the safe recovery path in this greenfield repo is to restore the files from git once the project is committed; before the first commit, recovery means rewriting the markdown files from the expected test fixtures.

## Artifacts and Notes

Important artifacts to capture after implementation:

    Final `TODO.md`
    Final `TODO_COMPLETED.md`
    `npm test` output
    `node src/cli.js lint` output

## Interfaces and Dependencies

Use the following project interfaces and dependencies:

- `neo-blessed` for the terminal UI.
- Node built-ins `fs`, `path`, `os`, and `child_process`.
- `vitest` for test execution.
- `node-pty` and `strip-ansi` for PTY-based interaction tests.
- `eslint` with a minimal ruleset for static linting of JavaScript source.

The implementation should end with these key modules and interfaces:

- In `src/task-files.js`, define functions that parse and serialize `TODO.md` and `TODO_COMPLETED.md`.
- In `src/task-service.js`, define high-level mutation functions for add, remove, reprioritize, complete, expand, and validated raw-file writes.
- In `src/tui-app.js`, define the screen layout, focus handling, recovery mode, and in-app command execution.
- In `src/cli.js`, define the executable entrypoint, help/version handling, `--root`, and migration errors for removed top-level subcommands.

Revision note: 2026-04-05. Created the initial ExecPlan after confirming the repository was a greenfield task list with no existing implementation.
Revision note: 2026-04-05. Updated progress, outcomes, and concrete verification after implementing the CLI and moving all current-goal tasks into `TODO_COMPLETED.md`.
Revision note: 2026-04-05. Updated the plan to reflect the later TUI-first `todoer-cli` refactor, PTY-based verification, and recovery/editing behavior.
