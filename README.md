# todoer-cli

`todoer-cli` is a terminal-first editor for `TODO.md` and `TODO_COMPLETED.md` workspaces. It opens directly into a nano-like TUI, keeps task files in a strict canonical format, auto-creates missing files, and normalizes or backs up malformed task files so the workspace stays recoverable.

It is built for developers who want a local, file-based TODO workflow instead of a hosted task manager. The primary interface is the full-screen terminal app, but the repository also includes lower-level task-file and task-service modules that enforce the same file rules programmatically.

## Table of Contents

- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [License](#license)

## Key Features

- Full-screen terminal UI launched with `todoer-cli`
- Direct editing of `TODO.md` with keyboard-first controls
- Read-only `TODO_COMPLETED.md` viewer with scrolling support
- Automatic creation of missing `TODO.md` and `TODO_COMPLETED.md`
- Canonical serialization of task files with strict comment headers and markdown line breaks
- Automatic backup of malformed task files to `TODO.bak` and `TODO_COMPLETED.bak`
- External file change detection and automatic reload when safe
- Optional service-layer task expansion through local Ollama

## Tech Stack

- Node.js 22
- npm for package management and local CLI linking
- `neo-blessed` for the full-screen terminal UI
- Plain JavaScript CommonJS modules in `src/`
- Vitest for automated tests
- ESLint for JavaScript linting
- Pixi for a reproducible local toolchain wrapper

## Prerequisites

- Node.js `22.x` or newer
- npm `11.x` or newer
- A POSIX-style terminal that supports full-screen TUIs
- Optional: `ollama` with the model `nemotron-3-nano:4b-128k` if you use the service-layer task expansion helper

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd todoer-cli
```

### 2. Install dependencies

Primary path with npm:

```bash
npm install
```

If you want the command available directly on your shell path:

```bash
./install.sh
```

That script runs `npm install` and `npm link`, then exposes the `todoer-cli` command globally for your user.

If you prefer Pixi for the local toolchain:

```bash
pixi run lint
pixi run test
```

### 3. Configure environment variables

No environment variables are required for the main TUI workflow.

### 4. Set up backing files

No database or external service is required. The application stores state in two Markdown files in the target workspace:

- `TODO.md`
- `TODO_COMPLETED.md`

If those files do not exist, `todoer-cli` creates them automatically with canonical headers. If they exist but cannot be parsed safely, the app backs them up to:

- `TODO.bak`
- `TODO_COMPLETED.bak`

and recreates clean canonical files.

### 5. Start the app

From the repository root:

```bash
todoer-cli
```

Or without linking the binary:

```bash
node src/cli.js
```

To manage a different workspace root:

```bash
todoer-cli --root /path/to/workspace
```

### 6. Verify startup

When the app launches successfully, it opens a full-screen TUI on `TODO.md`. Missing task files are created automatically, and valid existing files are normalized into canonical format if needed.

### 7. Basic in-app controls

The footer in the TUI shows the active shortcuts. The core controls implemented in the current app are:

- `Ctrl+J`: insert a new TODO line below the current task
- `Ctrl+L`: delete the current TODO line after confirmation
- `Ctrl+P`: switch between `TODO.md` and `TODO_COMPLETED.md`
- `Ctrl+S`: save `TODO.md`
- `Ctrl+C`: exit the TUI

## Architecture

### Directory Structure

```text
.
├── src/
│   ├── cli.js
│   ├── lint.js
│   ├── ollama.js
│   ├── task-files.js
│   ├── task-service.js
│   ├── tui-app.js
│   └── command-parser.js
├── test/
│   ├── task-service.test.js
│   └── tui.test.js
├── install.sh
├── package.json
├── pixi.toml
└── vitest.config.js
```

- [`src/cli.js`](src/cli.js) is the executable entrypoint. It parses `--help`, `--version`, and `--root`, then launches the TUI.
- [`src/tui-app.js`](src/tui-app.js) contains the full-screen editor, scroll handling, file switching, save flow, deletion confirmation, and external reload logic.
- [`src/task-files.js`](src/task-files.js) is the canonical file-format layer. It creates missing files, parses and serializes both markdown files, normalizes parseable files, and backs up malformed ones.
- [`src/task-service.js`](src/task-service.js) is the programmatic workspace mutation layer for add/remove/reprioritize/complete/expand operations.
- [`src/lint.js`](src/lint.js) validates the current workspace from the command line.
- [`src/ollama.js`](src/ollama.js) provides optional task expansion through a local Ollama model.
- [`test/tui.test.js`](test/tui.test.js) covers the interactive terminal workflow through `node-pty`.
- [`test/task-service.test.js`](test/task-service.test.js) covers canonicalization, backup behavior, and task-file/service operations.

### Runtime Flow

The main runtime path is:

```text
todoer-cli
-> src/cli.js
-> createApp(rootDir)
-> ensureTaskFiles(rootDir)
-> read + normalize task files
-> render neo-blessed TUI
-> edit/save/reload markdown files
```

At startup, the app resolves the target root directory, ensures `TODO.md` and `TODO_COMPLETED.md` exist, then loads and validates them. If a file is parseable but non-canonical, it is rewritten in canonical form. If a file is malformed, the original content is preserved in a `.bak` file before a clean canonical replacement is written.

### Data Flow

The app treats the Markdown files as the source of truth:

```text
TODO.md / TODO_COMPLETED.md
-> task-files parser and validator
-> in-memory TUI state
-> user edits
-> canonical serializer
-> atomic file write
```

The TUI reads raw file contents, builds an editable in-memory model for pending tasks, then serializes that model back to canonical Markdown on save. Completed items are displayed from `TODO_COMPLETED.md` in read-only mode.

### Storage Model

`TODO.md` is a pending-task file with strict header comments and lines in this shape:

```text
[] <priority>. <task> \
```

The pending-task header also makes the numbering rule explicit: `<priority>` must be plain decimal digits followed immediately by a period, such as `[] 1. First task`, `[] 2. Second task`, or `[] 14. Final task`. Priority numbers must be strictly increasing and never repeated. Formats like `1)`, `(1)`, `1:`, `-`, or `*` are invalid.

`TODO_COMPLETED.md` is a completed-task log with strict header comments and lines in this shape:

```text
[x] <timestamp> <task> \
```

Important storage rules enforced by the code:

- `TODO.md` priorities must be strictly increasing
- `TODO_COMPLETED.md` timestamps must use UTC ISO format `YYYY-MM-DDTHH:MM:SSZ`
- completed entries are serialized newest-first
- malformed files are backed up before replacement
- writes are atomic through temp-file rename

### Key Components

#### `task-files.js`

This module owns the repository’s file contract:

- canonical headers for both Markdown files
- parsing and validation
- canonical serialization
- atomic writes
- backup and recreation of malformed files

It is the layer that makes the workspace stable even when files are edited manually or generated externally.

#### `tui-app.js`

This module owns the terminal experience:

- full-screen layout with header, comments pane, body, and footer
- wrapped-line rendering for cramped terminals
- cursor and scroll state
- file switching between editable and read-only views
- reload behavior when files change on disk
- keyboard shortcuts and deletion confirmation

#### `task-service.js`

This module is a lower-level mutation API over the same file format. It supports:

- add task
- remove task
- reprioritize task
- complete task
- expand task through Ollama
- workspace validation

The current end-user TUI does not expose every service operation directly, but the module is part of the project’s internal architecture and test surface.

### Integration Boundaries

The repository has one optional external integration:

- `ollama` CLI, used by [`src/ollama.js`](src/ollama.js) for task expansion with the model `nemotron-3-nano:4b-128k`

If `ollama` is missing or fails, the expansion helper throws a fatal error rather than silently degrading.

## Environment Variables

The main application does not require environment variables.

| Variable | Required | Purpose | Example / Source |
| --- | --- | --- | --- |
| None | No | The TUI and file-validation flows run without environment configuration. | N/A |

## Available Scripts

| Command | Description |
| --- | --- |
| `todoer-cli` | Launch the full-screen TUI in the current directory. |
| `todoer-cli --root /path/to/workspace` | Launch the TUI against a different workspace root. |
| `node src/cli.js` | Launch the CLI without global linking. |
| `./install.sh` | Install npm dependencies and run `npm link` for the `todoer-cli` command. |
| `npm test` | Run the Vitest suite. |
| `npm run lint:js` | Run ESLint across the JavaScript sources. |
| `npm run lint:tasks` | Validate the current workspace task files through `src/lint.js`. |
| `npm run lint` | Run both JavaScript linting and task-file validation. |
| `pixi run test` | Run the test suite through the Pixi-managed environment. |
| `pixi run lint` | Run linting through the Pixi-managed environment. |

## License

MIT
