const fs = require("node:fs");
const blessed = require("neo-blessed");
const {
  TODO_HEADER_LINES,
  ensureTaskFiles,
  getCompletedFilePath,
  getTodoFilePath,
  readTaskFileContents,
  serializeTodoFile,
  validateTaskFileContents,
  writeFileAtomically,
} = require("./task-files");

let nextTaskId = 1;

function createTask(text, requestedPriority = null) {
  return {
    id: nextTaskId++,
    requestedPriority,
    text,
  };
}

function normalizeLineBreaks(value) {
  return value.replace(/\r\n/g, "\n");
}

function parseEditableTaskLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("//")) {
    return null;
  }

  const match = line.match(/^\[\]\s*(\d*)\.?\s*(.*)$/);
  if (!match) {
    return createTask(trimmed, null);
  }

  return createTask(match[2], null);
}

function loadEditableTodo(content) {
  const tasks = [];

  for (const line of normalizeLineBreaks(content).split("\n")) {
    const task = parseEditableTaskLine(line);
    if (task) {
      tasks.push(task);
    }
  }

  return tasks;
}

function sanitizePriority(value) {
  if (value == null) {
    return null;
  }

  const digits = String(value).replace(/\D/g, "");
  return digits ? digits : null;
}

function requestedPriorityNumber(task) {
  if (!task || task.requestedPriority == null) {
    return null;
  }

  const parsed = Number.parseInt(task.requestedPriority, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function reorderTasks(tasks, currentTaskId) {
  const reordered = tasks.map((task) => ({ ...task }));
  const originalOrder = reordered.map((task) => task.id);

  for (const taskId of originalOrder) {
    const currentIndex = reordered.findIndex((task) => task.id === taskId);
    if (currentIndex === -1) {
      continue;
    }

    const task = reordered[currentIndex];
    const priority = requestedPriorityNumber(task);
    if (!priority || priority < 1 || priority > reordered.length) {
      continue;
    }

    const targetIndex = priority - 1;
    if (targetIndex === currentIndex) {
      continue;
    }

    reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, task);
  }

  const newCurrentIndex = reordered.findIndex((task) => task.id === currentTaskId);

  return {
    tasks: reordered,
    currentIndex: newCurrentIndex === -1 ? 0 : newCurrentIndex,
  };
}

function commitMissingPriorities(tasks) {
  return tasks.map((task, index) => ({
    ...task,
    requestedPriority: task.requestedPriority == null ? String(index + 1) : task.requestedPriority,
  }));
}

function serializeEditableTodo(tasks) {
  const validTasks = tasks
    .map((task) => task.text.trim())
    .filter(Boolean)
    .map((text, index) => ({
      priority: index + 1,
      text,
    }));

  return serializeTodoFile(validTasks);
}

function visibleNumber(task, index) {
  return task.requestedPriority == null ? "" : task.requestedPriority || String(index + 1);
}

function renderTaskLine(task, index) {
  const number = visibleNumber(task, index) || String(index + 1);
  return `[] ${number}. ${task.text}`;
}

function taskPrefix(task, index) {
  return `[] ${visibleNumber(task, index) || String(index + 1)}. `;
}

function emptyTaskLine(index) {
  return `[] ${index + 1}. `;
}

function escapeTags(value) {
  return value.replaceAll("{", "\\{").replaceAll("}", "\\}");
}

function bodyInnerHeight(body) {
  return body.height - body.iheight;
}

function bodyInnerWidth(body) {
  return body.width - body.iwidth;
}

function commentsHeight() {
  return TODO_HEADER_LINES.length + 3;
}

function createApp(rootDir) {
  ensureTaskFiles(rootDir);

  const screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true,
    title: "todoer-cli",
    dockBorders: true,
  });

  const state = {
    rootDir,
    currentFile: "todo",
    statusMessage: "Ready.",
    lintError: "",
    quitting: false,
    dirty: false,
    externalConflict: false,
    todo: {
      tasks: [],
      currentIndex: 0,
      cursorColumn: 0,
      scrollOffset: 0,
    },
    completed: {
      content: "",
      lines: [],
      scrollOffset: 0,
    },
    files: {
      todoPath: getTodoFilePath(rootDir),
      completedPath: getCompletedFilePath(rootDir),
      todoMtimeMs: 0,
      completedMtimeMs: 0,
    },
  };

  const header = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: "100%",
    height: 3,
    border: "line",
    style: { border: { fg: "cyan" } },
  });

  const comments = blessed.box({
    parent: screen,
    top: 3,
    left: 0,
    width: "100%",
    height: commentsHeight(),
    border: "line",
    tags: false,
    style: { border: { fg: "cyan" } },
  });

  const body = blessed.box({
    parent: screen,
    top: commentsHeight() + 3,
    left: 0,
    width: "100%",
    height: `100%-${commentsHeight() + 6}`,
    border: "line",
    scrollable: true,
    alwaysScroll: true,
    tags: true,
    style: { border: { fg: "cyan" } },
  });

  const footer = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    width: "100%",
    height: 3,
    border: "line",
    style: { border: { fg: "cyan" } },
  });

  function setStatus(message) {
    state.statusMessage = message;
    render();
  }

  function updateFileStats() {
    state.files.todoMtimeMs = fs.statSync(state.files.todoPath).mtimeMs;
    state.files.completedMtimeMs = fs.statSync(state.files.completedPath).mtimeMs;
  }

  function syncCursorToValidTask() {
    const lineCount = state.todo.tasks.length;

    if (lineCount === 0) {
      state.todo.currentIndex = 0;
      state.todo.cursorColumn = emptyTaskLine(0).length;
      return;
    }

    if (state.todo.currentIndex >= lineCount) {
      state.todo.currentIndex = lineCount - 1;
    }
    if (state.todo.currentIndex < 0) {
      state.todo.currentIndex = 0;
    }

    const line = renderTaskLine(state.todo.tasks[state.todo.currentIndex], state.todo.currentIndex);
    if (state.todo.cursorColumn > line.length) {
      state.todo.cursorColumn = line.length;
    }
    if (state.todo.cursorColumn < 0) {
      state.todo.cursorColumn = 0;
    }
  }

  function ensureCursorVisible() {
    const cursorRow = visualCursorPosition().visualRow;
    const viewHeight = Math.max(1, bodyInnerHeight(body));

    if (cursorRow < state.todo.scrollOffset) {
      state.todo.scrollOffset = cursorRow;
    } else if (cursorRow >= state.todo.scrollOffset + viewHeight) {
      state.todo.scrollOffset = cursorRow - viewHeight + 1;
    }

    if (state.todo.scrollOffset < 0) {
      state.todo.scrollOffset = 0;
    }
  }

  function setTodoTasks(tasks, currentTaskId = null) {
    const reordered = reorderTasks(tasks, currentTaskId);
    state.todo.tasks = reordered.tasks;
    state.todo.currentIndex = reordered.currentIndex;
    syncCursorToValidTask();
    ensureCursorVisible();
  }

  function loadWorkspace(reason = "Ready.") {
    ensureTaskFiles(rootDir);
    const raw = readTaskFileContents(rootDir);
    state.files.todoPath = raw.todoPath;
    state.files.completedPath = raw.completedPath;
    state.completed.content = raw.completedContent;
    state.completed.lines = normalizeLineBreaks(raw.completedContent).split("\n");
    updateFileStats();

    try {
      validateTaskFileContents(raw);
      state.lintError = "";
    } catch (error) {
      state.lintError = error.message;
    }

    const currentTaskId = state.todo.tasks[state.todo.currentIndex]?.id ?? null;
    setTodoTasks(loadEditableTodo(raw.todoContent), currentTaskId);
    state.dirty = false;
    state.externalConflict = false;
    state.statusMessage = state.lintError ? `FATAL: ${state.lintError}` : reason;
  }

  function footerText() {
    if (state.currentFile === "completed") {
      return "^P TODO.md  ^C Exit  Read-only";
    }

    return "^J New Task  ^P Switch  ^S Save  ^C Exit";
  }

  function todoDisplayLines() {
    return state.todo.tasks.length === 0
      ? [emptyTaskLine(0)]
      : state.todo.tasks.map((task, index) => renderTaskLine(task, index));
  }

  function visualRowsForLine(line) {
    const width = Math.max(1, bodyInnerWidth(body));
    return Math.max(1, Math.ceil(Math.max(1, line.length) / width));
  }

  function visualRowStartForIndex(index) {
    const lines = todoDisplayLines();
    let row = 0;

    for (let current = 0; current < index; current += 1) {
      row += visualRowsForLine(lines[current] ?? "");
    }

    return row;
  }

  function visualCursorPosition() {
    const lines = todoDisplayLines();
    const currentLine = lines[state.todo.currentIndex] ?? emptyTaskLine(0);
    const width = Math.max(1, bodyInnerWidth(body));
    const safeColumn = Math.max(0, Math.min(state.todo.cursorColumn, currentLine.length));
    const zeroBasedColumn = safeColumn === currentLine.length ? Math.max(0, safeColumn - 1) : safeColumn;

    return {
      visualRow: visualRowStartForIndex(state.todo.currentIndex) + Math.floor(zeroBasedColumn / width),
      visualColumn: zeroBasedColumn % width,
    };
  }

  function applyLayout() {
    if (state.currentFile === "completed") {
      comments.hide();
      body.top = 3;
      body.height = Math.max(3, screen.height - 6);
      return;
    }

    comments.show();
    comments.height = commentsHeight();
    body.top = commentsHeight() + 3;
    body.height = Math.max(3, screen.height - (commentsHeight() + 6));
  }

  function renderBody() {
    if (state.currentFile === "completed") {
      body.setLabel(" TODO_COMPLETED.md ");
      body.setContent(escapeTags(state.completed.content));
      body.setScroll(state.completed.scrollOffset);
      return;
    }

    comments.setLabel(" TODO.md Comments ");
    comments.setContent(escapeTags(`${TODO_HEADER_LINES.join("\n")}\n`));
    body.setLabel(" TODO.md Tasks ");
    body.setContent(todoDisplayLines().map((line, index) => {
      if (index !== state.todo.currentIndex) {
        return escapeTags(line);
      }

      const safeColumn = Math.max(0, Math.min(state.todo.cursorColumn, line.length));
      const before = escapeTags(line.slice(0, safeColumn));
      const activeCharacter = line[safeColumn] ?? " ";
      const after = escapeTags(line.slice(Math.min(line.length, safeColumn + 1)));
      return `${before}{inverse}${escapeTags(activeCharacter)}{/inverse}${after}`;
    }).join("\n"));
    body.setScroll(state.todo.scrollOffset);
  }

  function renderCursor() {
    screen.program.showCursor();
    screen.program.hideCursor();
  }

  function render() {
    const dirtySuffix = state.dirty ? " | DIRTY" : "";
    const lintSuffix = state.lintError ? " | LINT ERROR" : "";
    header.setContent(` todoer-cli | ${state.currentFile === "todo" ? "TODO.md" : "TODO_COMPLETED.md"}${dirtySuffix}${lintSuffix}`);
    const statusPrefix = state.statusMessage && state.statusMessage !== "Ready." ? `${state.statusMessage} | ` : "";
    footer.setContent(`${statusPrefix}${footerText()}`);
    applyLayout();
    renderBody();
    screen.render();
    renderCursor();
  }

  function currentTask() {
    return state.todo.tasks[state.todo.currentIndex] ?? null;
  }

  function ensureTaskExists() {
    if (state.todo.tasks.length > 0) {
      return currentTask();
    }

    const task = createTask("", "1");
    setTodoTasks([task], task.id);
    state.todo.cursorColumn = emptyTaskLine(0).length;
    state.dirty = true;
    return currentTask();
  }

  function currentTextStart(task, index) {
    return taskPrefix(task, index).length;
  }

  function currentNumberLength(task) {
    return (task.requestedPriority ?? String(state.todo.currentIndex + 1)).length;
  }

  function moveHorizontal(delta) {
    syncCursorToValidTask();
    const task = currentTask();
    const line = task ? renderTaskLine(task, state.todo.currentIndex) : emptyTaskLine(0);
    state.todo.cursorColumn += delta;
    if (state.todo.cursorColumn < 0) {
      state.todo.cursorColumn = 0;
    }
    if (state.todo.cursorColumn > line.length) {
      state.todo.cursorColumn = line.length;
    }
    render();
  }

  function moveVertical(delta) {
    if (state.currentFile === "completed") {
      state.completed.scrollOffset = Math.max(0, state.completed.scrollOffset + delta);
      render();
      return;
    }

    if (state.todo.tasks.length === 0) {
      return;
    }

    state.todo.currentIndex = Math.max(0, Math.min(state.todo.tasks.length - 1, state.todo.currentIndex + delta));
    const task = currentTask();
    const maxLineLength = renderTaskLine(task, state.todo.currentIndex).length;
    if (state.todo.cursorColumn > maxLineLength) {
      state.todo.cursorColumn = maxLineLength;
    }
    ensureCursorVisible();
    render();
  }

  function moveLineStart() {
    state.todo.cursorColumn = 0;
    render();
  }

  function moveLineEnd() {
    const task = currentTask();
    const line = task ? renderTaskLine(task, state.todo.currentIndex) : emptyTaskLine(0);
    state.todo.cursorColumn = line.length;
    render();
  }

  function replaceTasks(tasks, currentTaskId) {
    setTodoTasks(tasks, currentTaskId);
    state.dirty = true;
  }

  function editNumber(task, editFn) {
    task.requestedPriority = sanitizePriority(editFn(task.requestedPriority ?? ""));
    const targetPriority = requestedPriorityNumber(task);
    if (!targetPriority || targetPriority < 1 || targetPriority > state.todo.tasks.length) {
      return;
    }

    const currentIndex = state.todo.tasks.findIndex((entry) => entry.id === task.id);
    if (currentIndex === -1) {
      return;
    }

    const updated = state.todo.tasks.map((entry) => ({ ...entry }));
    const [movingTask] = updated.splice(currentIndex, 1);
    updated.splice(targetPriority - 1, 0, movingTask);
    state.todo.tasks = updated;
    state.todo.currentIndex = targetPriority - 1;
  }

  function insertCharacter(ch) {
    if (state.currentFile !== "todo") {
      return;
    }

    if (!ch || /[\x00-\x1f\x7f]/.test(ch)) {
      return;
    }

    const task = ensureTaskExists();
    const currentIndex = state.todo.currentIndex;
    const textStart = currentTextStart(task, currentIndex);
    const numberLength = currentNumberLength(task);
    const numberStart = 3;
    const numberEnd = numberStart + numberLength;

    if (state.todo.cursorColumn <= numberEnd) {
      if (/\d/.test(ch)) {
        const insertionIndex = Math.max(0, Math.min(numberLength, state.todo.cursorColumn - numberStart));
        editNumber(task, (digits) => {
          if (insertionIndex < digits.length) {
            return `${digits.slice(0, insertionIndex)}${ch}${digits.slice(insertionIndex + 1)}`;
          }
          return `${digits.slice(0, insertionIndex)}${ch}${digits.slice(insertionIndex)}`;
        });
        state.todo.cursorColumn = Math.max(numberStart, state.todo.cursorColumn + 1);
        ensureCursorVisible();
        state.dirty = true;
        render();
        return;
      }

      state.todo.cursorColumn = textStart;
    }

    const textIndex = Math.max(0, state.todo.cursorColumn - textStart);
    task.text = `${task.text.slice(0, textIndex)}${ch}${task.text.slice(textIndex)}`;
    state.todo.cursorColumn += 1;
    state.dirty = true;
    ensureCursorVisible();
    render();
  }

  function deleteBackward() {
    if (state.currentFile !== "todo") {
      return;
    }

    const task = currentTask();
    if (!task) {
      return;
    }

    const textStart = currentTextStart(task, state.todo.currentIndex);
    const numberLength = currentNumberLength(task);
    const numberStart = 3;
    const numberEnd = numberStart + numberLength;

    if (state.todo.cursorColumn > textStart) {
      const textIndex = state.todo.cursorColumn - textStart;
      task.text = `${task.text.slice(0, textIndex - 1)}${task.text.slice(textIndex)}`;
      state.todo.cursorColumn -= 1;
      state.dirty = true;
      render();
      return;
    }

    if (state.todo.cursorColumn > numberStart && state.todo.cursorColumn <= numberEnd + 1) {
      const deleteIndex = state.todo.cursorColumn - numberStart - 1;
      editNumber(task, (digits) => `${digits.slice(0, deleteIndex)}${digits.slice(deleteIndex + 1)}`);
      state.todo.cursorColumn = Math.max(numberStart, state.todo.cursorColumn - 1);
      state.dirty = true;
      render();
    }
  }

  function deleteForward() {
    if (state.currentFile !== "todo") {
      return;
    }

    const task = currentTask();
    if (!task) {
      return;
    }

    const textStart = currentTextStart(task, state.todo.currentIndex);
    const numberLength = currentNumberLength(task);
    const numberStart = 3;
    const numberEnd = numberStart + numberLength;

    if (state.todo.cursorColumn >= textStart) {
      const textIndex = state.todo.cursorColumn - textStart;
      task.text = `${task.text.slice(0, textIndex)}${task.text.slice(textIndex + 1)}`;
      state.dirty = true;
      render();
      return;
    }

    if (state.todo.cursorColumn >= numberStart && state.todo.cursorColumn < numberEnd) {
      const deleteIndex = state.todo.cursorColumn - numberStart;
      editNumber(task, (digits) => `${digits.slice(0, deleteIndex)}${digits.slice(deleteIndex + 1)}`);
      state.dirty = true;
      render();
    }
  }

  function insertNewTask() {
    if (state.currentFile !== "todo") {
      return;
    }

    const committed = commitMissingPriorities(state.todo.tasks);
    const insertionIndex = state.todo.tasks.length === 0 ? 0 : state.todo.currentIndex + 1;
    const updated = committed.map((task) => ({ ...task }));
    const task = createTask("", String(insertionIndex + 1));
    updated.splice(insertionIndex, 0, task);
    replaceTasks(updated, task.id);
    state.todo.currentIndex = insertionIndex;
    state.todo.cursorColumn = taskPrefix(task, insertionIndex).length;
    ensureCursorVisible();
    render();
  }

  function switchFile() {
    if (state.currentFile === "todo") {
      state.currentFile = "completed";
      screen.program.hideCursor();
      setStatus("Showing TODO_COMPLETED.md (read-only).");
      return;
    }

    state.currentFile = "todo";
    setStatus("Showing TODO.md.");
  }

  function saveTodo() {
    if (state.currentFile !== "todo") {
      setStatus("FATAL: TODO_COMPLETED.md is read-only.");
      return;
    }

    const todoContent = serializeEditableTodo(state.todo.tasks);
    try {
      validateTaskFileContents({
        todoContent,
        completedContent: state.completed.content,
        todoPath: state.files.todoPath,
        completedPath: state.files.completedPath,
      });
    } catch (error) {
      setStatus(`FATAL: ${error.message}`);
      return;
    }

    writeFileAtomically(state.files.todoPath, todoContent);
    loadWorkspace("Saved TODO.md.");
    state.currentFile = "todo";
    render();
  }

  function handleExternalReload() {
    const todoMtimeMs = fs.statSync(state.files.todoPath).mtimeMs;
    const completedMtimeMs = fs.statSync(state.files.completedPath).mtimeMs;
    const changed = todoMtimeMs !== state.files.todoMtimeMs || completedMtimeMs !== state.files.completedMtimeMs;

    if (!changed) {
      return;
    }

    if (state.dirty && todoMtimeMs !== state.files.todoMtimeMs) {
      state.files.todoMtimeMs = todoMtimeMs;
      state.files.completedMtimeMs = completedMtimeMs;
      state.externalConflict = true;
      setStatus("FATAL: TODO.md changed outside while you have unsaved edits.");
      return;
    }

    loadWorkspace("Reloaded from disk.");
    render();
  }

  screen.on("keypress", (ch, key) => {
    if (state.quitting) {
      return;
    }

    if ((key.ctrl && key.name === "q") || (key.ctrl && key.name === "c")) {
      state.quitting = true;
      screen.destroy();
      return;
    }

    if (key.ctrl && key.name === "p") {
      switchFile();
      return;
    }

    if (key.ctrl && key.name === "s") {
      saveTodo();
      return;
    }

    if ((key.ctrl && key.name === "j") || key.name === "enter") {
      insertNewTask();
      return;
    }

    if (key.ctrl) {
      return;
    }

    if (key.name === "up") {
      moveVertical(-1);
      return;
    }

    if (key.name === "down") {
      moveVertical(1);
      return;
    }

    if (key.name === "left") {
      moveHorizontal(-1);
      return;
    }

    if (key.name === "right") {
      moveHorizontal(1);
      return;
    }

    if (key.name === "home") {
      moveLineStart();
      return;
    }

    if (key.name === "end") {
      moveLineEnd();
      return;
    }

    if (key.name === "pageup") {
      moveVertical(-bodyInnerHeight(body));
      return;
    }

    if (key.name === "pagedown") {
      moveVertical(bodyInnerHeight(body));
      return;
    }

    if (key.name === "backspace") {
      deleteBackward();
      return;
    }

    if (key.name === "delete") {
      deleteForward();
      return;
    }

    insertCharacter(ch || key.sequence);
  });

  const reloadTimer = setInterval(() => {
    try {
      handleExternalReload();
    } catch (error) {
      setStatus(`FATAL: ${error.message}`);
    }
  }, 1000);

  screen.on("destroy", () => {
    clearInterval(reloadTimer);
    screen.program.showCursor();
  });

  screen.on("resize", () => {
    render();
  });

  loadWorkspace();
  render();

  return { screen };
}

module.exports = {
  createApp,
};
