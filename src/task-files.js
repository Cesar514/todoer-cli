const fs = require("node:fs");
const path = require("node:path");

const TODO_FILE_NAME = "TODO.md";
const COMPLETED_FILE_NAME = "TODO_COMPLETED.md";
const TODO_BACKUP_FILE_NAME = "TODO.bak";
const COMPLETED_BACKUP_FILE_NAME = "TODO_COMPLETED.bak";

const TODO_HEADER_LINES = [
  "// Current goal: keep this TODO list accurate while implementing the user's current request.",
  "// Rule: complete all tasks asked by the user and verify they are fully completed before moving them to TODO_COMPLETED.md.",
  "// Format: [] <priority>. <task>",
];

const COMPLETED_HEADER_LINES = [
  "// Completed tasks for the current goal.",
  "// Format: [x] <timestamp> <task>",
  "// Example: [x] 2026-04-05T20:39:27Z Verify the completed-task log is sorted newest-first using 24-hour HH:MM:SS UTC timestamps.",
];

function markdownLine(value) {
  return `${value} \\`;
}

function getTodoFilePath(rootDir) {
  return path.join(rootDir, TODO_FILE_NAME);
}

function getCompletedFilePath(rootDir) {
  return path.join(rootDir, COMPLETED_FILE_NAME);
}

function getTodoBackupFilePath(rootDir) {
  return path.join(rootDir, TODO_BACKUP_FILE_NAME);
}

function getCompletedBackupFilePath(rootDir) {
  return path.join(rootDir, COMPLETED_BACKUP_FILE_NAME);
}

function readRequiredFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file is missing: ${filePath}`);
  }

  return fs.readFileSync(filePath, "utf8");
}

function ensureTaskFiles(rootDir) {
  const todoPath = getTodoFilePath(rootDir);
  const completedPath = getCompletedFilePath(rootDir);

  if (!fs.existsSync(todoPath)) {
    writeFileAtomically(todoPath, serializeTodoFile([]));
  }

  if (!fs.existsSync(completedPath)) {
    writeFileAtomically(completedPath, serializeCompletedFile([]));
  }

  normalizeTaskFile(todoPath, getTodoBackupFilePath(rootDir), parseTodoFile, serializeTodoFile, []);
  normalizeTaskFile(completedPath, getCompletedBackupFilePath(rootDir), parseCompletedFile, serializeCompletedFile, []);

  return { todoPath, completedPath };
}

function parseTodoFile(content, filePath = TODO_FILE_NAME) {
  const tasks = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let previousPriority = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("//")) {
      continue;
    }

    const match = line.match(/^\[\]\s+(\d+)\.\s+(.+?)(?:\s+\\)?\s*$/);
    if (!match) {
      throw new Error(`Invalid TODO entry in ${filePath}: "${line}"`);
    }

    const priority = Number.parseInt(match[1], 10);
    const text = match[2].trim();

    if (priority <= previousPriority) {
      throw new Error(
        `Invalid priority order in ${filePath}: expected a value greater than ${previousPriority}, received ${priority}`,
      );
    }

    if (!text) {
      throw new Error(`Task text cannot be empty in ${filePath}`);
    }

    tasks.push({ priority, text });
    previousPriority = priority;
  }

  return tasks;
}

function parseCompletedFile(content, filePath = COMPLETED_FILE_NAME) {
  const entries = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("//")) {
      continue;
    }

    const match = line.match(/^\[x\]\s+(\S+)\s+(.+?)(?:\s+\\)?\s*$/);
    if (!match) {
      throw new Error(`Invalid completed entry in ${filePath}: "${line}"`);
    }

    const timestamp = match[1];
    const text = match[2].trim();

    if (!timestamp.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)) {
      throw new Error(`Invalid completion timestamp in ${filePath}: "${timestamp}"`);
    }

    if (!text) {
      throw new Error(`Completed task text cannot be empty in ${filePath}`);
    }

    entries.push({ timestamp, text });
  }

  return entries;
}

function serializeTodoFile(tasks) {
  const lines = [...TODO_HEADER_LINES.map(markdownLine), ""];

  for (const task of tasks) {
    lines.push(markdownLine(`[] ${task.priority}. ${task.text}`));
  }

  return `${lines.join("\n")}\n`;
}

function serializeCompletedFile(entries) {
  const lines = [...COMPLETED_HEADER_LINES.map(markdownLine), ""];

  for (const entry of [...entries].sort((left, right) => right.timestamp.localeCompare(left.timestamp))) {
    lines.push(markdownLine(`[x] ${entry.timestamp} ${entry.text}`));
  }

  return `${lines.join("\n")}\n`;
}

function writeFileAtomically(filePath, content) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, content, "utf8");
  fs.renameSync(tempPath, filePath);
}

function normalizeTaskFile(filePath, backupPath, parseFn, serializeFn, emptyEntries) {
  const originalContent = readRequiredFile(filePath);

  try {
    const parsed = parseFn(originalContent, filePath);
    const canonicalContent = serializeFn(parsed);
    if (canonicalContent !== originalContent) {
      writeFileAtomically(filePath, canonicalContent);
    }
  } catch {
    writeFileAtomically(backupPath, originalContent);
    writeFileAtomically(filePath, serializeFn(emptyEntries));
  }
}

function readTaskFileContents(rootDir) {
  const { todoPath, completedPath } = ensureTaskFiles(rootDir);

  return {
    todoPath,
    completedPath,
    todoContent: readRequiredFile(todoPath),
    completedContent: readRequiredFile(completedPath),
  };
}

function validateTaskFileContents({ todoContent, completedContent, todoPath = TODO_FILE_NAME, completedPath = COMPLETED_FILE_NAME }) {
  return {
    tasks: parseTodoFile(todoContent, todoPath),
    completed: parseCompletedFile(completedContent, completedPath),
  };
}

function readTaskFiles(rootDir) {
  const { todoPath, completedPath, todoContent, completedContent } = readTaskFileContents(rootDir);

  return {
    todoPath,
    completedPath,
    ...validateTaskFileContents({ todoContent, completedContent, todoPath, completedPath }),
  };
}

module.exports = {
  COMPLETED_FILE_NAME,
  COMPLETED_BACKUP_FILE_NAME,
  TODO_FILE_NAME,
  TODO_BACKUP_FILE_NAME,
  COMPLETED_HEADER_LINES,
  TODO_HEADER_LINES,
  ensureTaskFiles,
  getCompletedFilePath,
  getCompletedBackupFilePath,
  getTodoFilePath,
  getTodoBackupFilePath,
  parseCompletedFile,
  parseTodoFile,
  readRequiredFile,
  readTaskFileContents,
  readTaskFiles,
  serializeCompletedFile,
  serializeTodoFile,
  validateTaskFileContents,
  writeFileAtomically,
};
