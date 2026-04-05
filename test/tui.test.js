const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const pty = require("node-pty");
const stripAnsiModule = require("strip-ansi");
const { COMPLETED_HEADER_LINES, TODO_HEADER_LINES, serializeCompletedFile, serializeTodoFile } = require("../src/task-files");

const REPO_ROOT = path.resolve(__dirname, "..");
const CLI_PATH = path.join(REPO_ROOT, "src", "cli.js");

const tempDirs = [];
const terminals = [];

function createWorkspace(todoTasks = [], completedEntries = [], createFiles = true) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "todoer-tui-"));
  tempDirs.push(workspace);

  if (createFiles) {
    fs.writeFileSync(
      path.join(workspace, "TODO.md"),
      serializeTodoFile(todoTasks.map((text, index) => ({ priority: index + 1, text }))),
      "utf8",
    );
    fs.writeFileSync(
      path.join(workspace, "TODO_COMPLETED.md"),
      serializeCompletedFile(completedEntries.map((entry) => ({ timestamp: entry.timestamp, text: entry.text }))),
      "utf8",
    );
  }

  return workspace;
}

function readFile(workspace, name) {
  return fs.readFileSync(path.join(workspace, name), "utf8");
}

function normalizeOutput(output) {
  const stripAnsi = stripAnsiModule.default || stripAnsiModule;
  return stripAnsi(output).replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "").replace(/\r/g, "\n");
}

function compactText(text) {
  return text.replace(/\s+/g, "");
}

function launchTui(workspace, extraEnv = {}, args = []) {
  const term = pty.spawn(process.execPath, [CLI_PATH, ...args], {
    cwd: workspace,
    env: { ...process.env, ...extraEnv },
    cols: 120,
    rows: 40,
    name: "xterm-color",
  });

  let output = "";
  term.onData((chunk) => {
    output += chunk;
  });
  terminals.push(term);

  return {
    term,
    getOutput() {
      return normalizeOutput(output);
    },
  };
}

async function waitFor(predicate, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = predicate();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for terminal state");
}

async function waitForText(session, text, timeoutMs = 8000) {
  await waitFor(() => compactText(session.getOutput()).includes(compactText(text)), timeoutMs);
}

async function pressKey(session, sequence, delayMs = 120) {
  session.term.write(sequence);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function typeText(session, text, delayMs = 30) {
  for (const char of text) {
    session.term.write(char);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

async function scrollWheel(session, direction = "down", delayMs = 120) {
  const code = direction === "down" ? 65 : 64;
  session.term.write(`\u001b[<${code};10;10M`);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

afterEach(() => {
  while (terminals.length > 0) {
    terminals.pop().kill();
  }

  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe("todoer-cli nano-like TUI", () => {
  test("creates missing task files and opens TODO.md with comment rules", async () => {
    const workspace = createWorkspace([], [], false);
    const session = launchTui(workspace);

    await waitForText(session, "TODO.md");
    await waitForText(session, "^J New Task");
    await waitFor(() => fs.existsSync(path.join(workspace, "TODO.md")));
    await waitFor(() => fs.existsSync(path.join(workspace, "TODO_COMPLETED.md")));
    expect(readFile(workspace, "TODO.md")).toContain(TODO_HEADER_LINES[0]);
    expect(readFile(workspace, "TODO.md")).toContain(TODO_HEADER_LINES[2]);
    expect(readFile(workspace, "TODO.md")).not.toContain("Shortcuts:");
    expect(readFile(workspace, "TODO.md")).not.toContain("Priorities must");
    expect(readFile(workspace, "TODO_COMPLETED.md")).toContain(COMPLETED_HEADER_LINES[1]);
  }, 12000);

  test("ctrl+j adds a new numbered task and ctrl+s saves it", async () => {
    const workspace = createWorkspace(["First task"]);
    const session = launchTui(workspace);

    await waitForText(session, "First task");
    await pressKey(session, "\r");
    await typeText(session, "Second task");
    await pressKey(session, "\u0013");
    await waitFor(() => readFile(workspace, "TODO.md").includes("[] 2. Second task"));
  }, 12000);

  test("ctrl+j inserts directly below the current task instead of appending to the bottom", async () => {
    const workspace = createWorkspace(["First task", "Second task", "Third task"]);
    const session = launchTui(workspace);

    await waitForText(session, "First task");
    await pressKey(session, "\n");
    await typeText(session, "Inserted task");
    await pressKey(session, "\u0013");
    await waitFor(() => readFile(workspace, "TODO.md").includes("[] 2. Inserted task"));
    expect(readFile(workspace, "TODO.md")).toContain("[] 3. Second task");
    expect(readFile(workspace, "TODO.md")).toContain("[] 4. Third task");
  }, 12000);

  test("ctrl+p switches to TODO_COMPLETED.md and keeps it read-only", async () => {
    const workspace = createWorkspace(["First task"], [{ timestamp: "2026-04-05T18:00:00Z", text: "Older task" }]);
    const originalCompleted = readFile(workspace, "TODO_COMPLETED.md");
    const session = launchTui(workspace);

    await waitForText(session, "First task");
    await pressKey(session, "\u0010");
    await waitForText(session, "TODO_COMPLETED.md");
    await waitForText(session, "read-only");
    await typeText(session, "SHOULD NOT CHANGE");
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(readFile(workspace, "TODO_COMPLETED.md")).toBe(originalCompleted);
  }, 12000);

  test("changing a task number reorders it to that priority on save", async () => {
    const workspace = createWorkspace(["First task", "Second task", "Third task"]);
    const session = launchTui(workspace);

    await waitForText(session, "Third task");
    await typeText(session, "3");
    await pressKey(session, "\u0013");
    await waitFor(() => readFile(workspace, "TODO.md").includes("[] 1. Second task"));
    expect(readFile(workspace, "TODO.md")).toContain("[] 3. First task");
  }, 12000);

  test("deleting a priority number lets it be replaced cleanly", async () => {
    const workspace = createWorkspace(["First task", "Second task", "Third task"]);
    const session = launchTui(workspace);

    await waitForText(session, "First task");
    await pressKey(session, "\u001b[C");
    await pressKey(session, "\u001b[C");
    await pressKey(session, "\u001b[C");
    await pressKey(session, "\u001b[C");
    await pressKey(session, "\u007f");
    await typeText(session, "3");
    await pressKey(session, "\u0013");
    await waitFor(() => readFile(workspace, "TODO.md").includes("[] 3. First task"));
    expect(readFile(workspace, "TODO.md")).toContain("[] 1. Second task");
  }, 12000);

  test("saving keeps the editor on the current task instead of jumping back to the top", async () => {
    const workspace = createWorkspace(["First task", "Second task", "Third task"]);
    const session = launchTui(workspace);

    await waitForText(session, "First task");
    await pressKey(session, "\u001b[B");
    await pressKey(session, "\u001b[B");
    await pressKey(session, "\u0013");
    await pressKey(session, "\r");
    await typeText(session, "After third");
    await pressKey(session, "\u0013");
    await waitFor(() => readFile(workspace, "TODO.md").includes("[] 4. After third"));
    expect(readFile(workspace, "TODO.md")).not.toContain("[] 2. After third");
  }, 12000);

  test("auto reload picks up external TODO.md changes", async () => {
    const workspace = createWorkspace(["First task"]);
    const session = launchTui(workspace);

    await waitForText(session, "First task");
    await new Promise((resolve) => setTimeout(resolve, 1200));
    fs.writeFileSync(
      path.join(workspace, "TODO.md"),
      `${[...TODO_HEADER_LINES, "", "[] 1. Replaced outside", ""].join("\n")}`,
      "utf8",
    );
    await waitForText(session, "Replaced outside", 12000);
    await waitForText(session, "loaded from disk.", 12000);
  }, 14000);

  test("resizes cleanly, keeps footer shortcuts visible, and preserves wrapped task editing", async () => {
    const workspace = createWorkspace([
      "First task with enough text to wrap when the terminal becomes narrow and force the cursor layout to adjust correctly",
      "Second task",
    ]);
    const session = launchTui(workspace);

    await waitForText(session, "First task");
    await waitForText(session, "^J New Task");
    session.term.resize(80, 20);
    await new Promise((resolve) => setTimeout(resolve, 400));
    await waitForText(session, "Second task");
    await waitForText(session, "^C Exit");
    session.term.resize(45, 18);
    await new Promise((resolve) => setTimeout(resolve, 400));
    await waitForText(session, "^J New Task");
    session.term.resize(120, 40);
    await new Promise((resolve) => setTimeout(resolve, 400));
    await waitForText(session, "First task");
  }, 12000);

  test("ctrl+c exits the TUI", async () => {
    const workspace = createWorkspace(["First task"]);
    const session = launchTui(workspace);

    await waitForText(session, "First task");
    await pressKey(session, "\u0003");
    await waitFor(() => !session.term.pid || session.term._destroyed === true || session.term._socket.destroyed === true, 12000);
  }, 12000);

  test("unused control shortcuts do not insert junk into TODO.md", async () => {
    const workspace = createWorkspace(["First task"]);
    const session = launchTui(workspace);

    await waitForText(session, "First task");
    await pressKey(session, "\u0018");
    await pressKey(session, "\u0013");
    await waitFor(() => readFile(workspace, "TODO.md").includes("[] 1. First task"));
    expect(readFile(workspace, "TODO.md")).not.toContain("\u0018");
    expect(readFile(workspace, "TODO.md")).not.toContain("CAN");
  }, 12000);

  test("completed view stays scrollable with arrows and mouse wheel", async () => {
    const completedEntries = Array.from({ length: 30 }, (_, index) => ({
      timestamp: `2026-04-05T18:${String(index).padStart(2, "0")}:00Z`,
      text: `Completed task ${index + 1}`,
    }));
    const workspace = createWorkspace(["First task"], completedEntries);
    const session = launchTui(workspace);

    await waitForText(session, "First task");
    await pressKey(session, "\u0010");
    await waitForText(session, "TODO_COMPLETED.md");
    for (let index = 0; index < 20; index += 1) {
      await pressKey(session, "\u001b[B", 20);
    }
    await scrollWheel(session, "down", 200);
    await scrollWheel(session, "up", 200);
    await waitFor(() => session.term._destroyed !== true && session.term._socket.destroyed !== true, 12000);
    await waitForText(session, "read-only");
  }, 12000);
});
