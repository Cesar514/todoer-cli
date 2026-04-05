#!/usr/bin/env node
const path = require("node:path");
const pkg = require("../package.json");
const { createApp } = require("./tui-app");

const REMOVED_SUBCOMMANDS = new Set(["add", "remove", "done", "reprioritize", "expand", "lint", "list"]);

function printHelp() {
  console.log([
    "todoer-cli",
    "",
    "Usage:",
    "  todoer-cli [--root <path>]",
    "  todoer-cli --help",
    "  todoer-cli --version",
    "",
    "Launch the full-screen TUI and use in-app commands there.",
  ].join("\n"));
}

function migrationError(command) {
  console.error(`FATAL: Top-level subcommand "${command}" was removed. Launch "todoer-cli" and run the command inside the TUI.`);
}

function parseArgs(argv) {
  let rootDir = process.cwd();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--version" || arg === "-v") {
      console.log(pkg.version);
      process.exit(0);
    }

    if (arg === "--root") {
      index += 1;
      if (index >= argv.length) {
        throw new Error("--root requires a path");
      }
      rootDir = path.resolve(argv[index]);
      continue;
    }

    if (REMOVED_SUBCOMMANDS.has(arg)) {
      migrationError(arg);
      process.exit(1);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { rootDir };
}

function main() {
  try {
    const { rootDir } = parseArgs(process.argv.slice(2));
    createApp(rootDir);
  } catch (error) {
    console.error(`FATAL: ${error.message}`);
    process.exit(1);
  }
}

main();
