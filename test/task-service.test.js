const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { COMPLETED_HEADER_LINES, TODO_HEADER_LINES } = require("../src/task-files");
const {
  addTask,
  completeTask,
  removeTask,
  reprioritizeTask,
  validateWorkspaceContents,
  writeWorkspaceContents,
} = require("../src/task-service");

const TODO_HEADER = [...TODO_HEADER_LINES, ""];
const COMPLETED_HEADER = [...COMPLETED_HEADER_LINES, ""];

const tempDirs = [];

function createWorkspace(todoLines, completedLines = []) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "todoer-service-"));
  tempDirs.push(workspace);
  fs.writeFileSync(path.join(workspace, "TODO.md"), `${TODO_HEADER.concat(todoLines).join("\n")}\n`, "utf8");
  fs.writeFileSync(path.join(workspace, "TODO_COMPLETED.md"), `${COMPLETED_HEADER.concat(completedLines).join("\n")}\n`, "utf8");
  return workspace;
}

function readFile(workspace, name) {
  return fs.readFileSync(path.join(workspace, name), "utf8");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe("task service", () => {
  test("mutations keep priorities and completion format valid", () => {
    const workspace = createWorkspace(["[] 1. First task", "[] 2. Second task"]);
    addTask(workspace, "Inserted task", 2);
    reprioritizeTask(workspace, 3, 1);
    removeTask(workspace, 2);
    completeTask(workspace, 1, "2026-04-05T16:50:00Z");
    completeTask(workspace, 1, "2026-04-05T16:51:00Z");

    const todoContent = readFile(workspace, "TODO.md");
    const completedContent = readFile(workspace, "TODO_COMPLETED.md");
    expect(todoContent).not.toContain("[] 1. First task");
    expect(todoContent).not.toContain("[] 1.");
    expect(completedContent.indexOf("[x] 2026-04-05T16:51:00Z Inserted task")).toBeLessThan(
      completedContent.indexOf("[x] 2026-04-05T16:50:00Z Second task"),
    );
  });

  test("writeWorkspaceContents validates both files before writing", () => {
    const workspace = createWorkspace(["[] 1. First task"]);
    const originalCompleted = readFile(workspace, "TODO_COMPLETED.md");

    expect(() => {
      writeWorkspaceContents(
        workspace,
        `${TODO_HEADER.join("\n")}[] 1. First task\n`,
        `${COMPLETED_HEADER.join("\n")}broken\n`,
      );
    }).toThrow("Invalid completed entry");

    expect(readFile(workspace, "TODO_COMPLETED.md")).toBe(originalCompleted);
  });

  test("validateWorkspaceContents accepts valid file contents", () => {
    const workspace = createWorkspace(["[] 1. First task"]);
    const todoContent = readFile(workspace, "TODO.md");
    const completedContent = readFile(workspace, "TODO_COMPLETED.md");

    const parsed = validateWorkspaceContents(workspace, todoContent, completedContent);
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.completed).toHaveLength(0);
  });
});
