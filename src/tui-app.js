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

  const match = line.match(/^\[\]\s*(\d*)\.?\s*(.*?)(?:\s+\\)?\s*$/);
  if (!match) {
    return createTask(trimmed, null);
  }

  return createTask(match[2], sanitizePriority(match[1]));
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

function normalizeRequestedPriorities(tasks) {
  let previousPriority = 0;

  return tasks.map((task) => {
    const desiredPriority = requestedPriorityNumber(task);
    const nextPriority = desiredPriority == null ? previousPriority + 1 : Math.max(desiredPriority, previousPriority + 1);
    previousPriority = nextPriority;
    return {
      ...task,
      requestedPriority: String(nextPriority),
    };
  });
}

function reorderTasks(tasks, currentTaskId = null) {
  const reordered = normalizeRequestedPriorities(
    tasks
      .map((task, index) => ({ ...task, originalIndex: index }))
      .sort((left, right) => {
        const leftPriority = requestedPriorityNumber(left) ?? Number.POSITIVE_INFINITY;
        const rightPriority = requestedPriorityNumber(right) ?? Number.POSITIVE_INFINITY;
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }
        return left.originalIndex - right.originalIndex;
      }),
  );
  const newCurrentIndex = reordered.findIndex((task) => task.id === currentTaskId);

  return {
    tasks: reordered,
    currentIndex: newCurrentIndex === -1 ? 0 : newCurrentIndex,
  };
}

function commitMissingPriorities(tasks) {
  return normalizeRequestedPriorities(tasks.map((task) => ({ ...task })));
}

function serializeEditableTodo(tasks) {
  const prioritizedTasks = tasks
    .map((task, index) => ({ ...task, originalIndex: index }))
    .filter((task) => task.text.trim())
    .sort((left, right) => {
      const leftPriority = requestedPriorityNumber(left) ?? Number.POSITIVE_INFINITY;
      const rightPriority = requestedPriorityNumber(right) ?? Number.POSITIVE_INFINITY;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return left.originalIndex - right.originalIndex;
    });

  const validTasks = normalizeRequestedPriorities(prioritizedTasks)
    .map((task) => ({
      priority: requestedPriorityNumber(task),
      text: task.text.trim(),
    }))
    .filter((task) => task.priority != null && task.text);

  return serializeTodoFile(validTasks);
}

function visibleNumber(task, index) {
  return task.requestedPriority == null ? "" : task.requestedPriority;
}

function renderTaskLine(task, index) {
  const number = visibleNumber(task, index);
  return `[] ${number}. ${task.text}`;
}

function taskPrefix(task, index) {
  return `[] ${visibleNumber(task, index)}. `;
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
    mouse: true,
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
    confirmDeleteOpen: false,
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
    mouse: true,
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
    mouse: true,
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

  const confirmDelete = blessed.box({
    parent: screen,
    top: "center",
    left: "center",
    width: 46,
    height: 7,
    border: "line",
    hidden: true,
    tags: false,
    style: {
      border: { fg: "yellow" },
      bg: "black",
    },
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

  function completedVisualRowCount() {
    const width = Math.max(1, bodyInnerWidth(body));
    return Math.max(
      1,
      state.completed.lines.reduce((total, line) => total + Math.max(1, Math.ceil(Math.max(1, line.length) / width)), 0),
    );
  }

  function maxCompletedScrollOffset() {
    return Math.max(0, completedVisualRowCount() - Math.max(1, bodyInnerHeight(body)));
  }

  function clampCompletedScrollOffset() {
    state.completed.scrollOffset = clamp(state.completed.scrollOffset, 0, maxCompletedScrollOffset());
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

  function setTodoTasks(tasks, options = {}) {
    const { currentTaskId = null, preferredIndex = null, preferredCursorColumn = null, preferredScrollOffset = null } = options;
    const reordered = reorderTasks(tasks, currentTaskId);
    state.todo.tasks = reordered.tasks;
    state.todo.currentIndex = preferredIndex == null ? reordered.currentIndex : preferredIndex;
    syncCursorToValidTask();
    if (preferredCursorColumn != null) {
      state.todo.cursorColumn = preferredCursorColumn;
      syncCursorToValidTask();
    }
    if (preferredScrollOffset != null) {
      state.todo.scrollOffset = Math.max(0, preferredScrollOffset);
    }
    ensureCursorVisible();
  }

  function loadWorkspace(reason = "Ready.", options = {}) {
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

    const loadedTasks = loadEditableTodo(raw.todoContent);
    setTodoTasks(loadedTasks, {
      currentTaskId: state.todo.tasks[state.todo.currentIndex]?.id ?? null,
      preferredIndex: options.preservePosition ? state.todo.currentIndex : null,
      preferredCursorColumn: options.preservePosition ? state.todo.cursorColumn : null,
      preferredScrollOffset: options.preservePosition ? state.todo.scrollOffset : null,
    });
    if (options.preservePosition) {
      state.completed.scrollOffset = Math.max(0, state.completed.scrollOffset);
    } else {
      state.completed.scrollOffset = 0;
    }
    clampCompletedScrollOffset();
    state.dirty = false;
    state.externalConflict = false;
    state.statusMessage = state.lintError ? `FATAL: ${state.lintError}` : reason;
  }

  function footerText() {
    if (state.currentFile === "completed") {
      return "^P TODO.md  ^C Exit  Read-only";
    }

    return "^J New Task  ^L Delete  ^P Switch  ^S Save  ^C Exit";
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
      clampCompletedScrollOffset();
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
    if (state.confirmDeleteOpen) {
      confirmDelete.setContent("Delete this line?\n\nY / Enter = Yes\nN / Esc = No");
      confirmDelete.show();
      confirmDelete.setFront();
    } else {
      confirmDelete.hide();
    }
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
    return (task.requestedPriority ?? "").length;
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
      state.completed.scrollOffset += delta;
      clampCompletedScrollOffset();
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
    setTodoTasks(tasks, { currentTaskId });
    state.dirty = true;
  }

  function editNumber(task, editFn) {
    task.requestedPriority = sanitizePriority(editFn(task.requestedPriority ?? ""));
    const targetPriority = requestedPriorityNumber(task);
    if (!targetPriority || targetPriority < 1) {
      return;
    }

    const currentIndex = state.todo.tasks.findIndex((entry) => entry.id === task.id);
    if (currentIndex === -1) {
      return;
    }

    const updated = state.todo.tasks.map((entry) => ({ ...entry }));
    const [movingTask] = updated.splice(currentIndex, 1);
    const insertionIndex = updated.findIndex((entry) => {
      const otherPriority = requestedPriorityNumber(entry);
      return otherPriority != null && otherPriority >= targetPriority;
    });
    updated.splice(insertionIndex === -1 ? updated.length : insertionIndex, 0, movingTask);
    const reordered = reorderTasks(updated, task.id).tasks;
    state.todo.tasks = reordered;
    state.todo.currentIndex = reordered.findIndex((entry) => entry.id === task.id);
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
      ensureCursorVisible();
      render();
      return;
    }

    if (state.todo.cursorColumn > numberStart && state.todo.cursorColumn <= numberEnd + 1) {
      const deleteIndex = state.todo.cursorColumn - numberStart - 1;
      editNumber(task, (digits) => `${digits.slice(0, deleteIndex)}${digits.slice(deleteIndex + 1)}`);
      state.todo.cursorColumn = Math.max(numberStart, state.todo.cursorColumn - 1);
      state.dirty = true;
      ensureCursorVisible();
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
      ensureCursorVisible();
      render();
      return;
    }

    if (state.todo.cursorColumn >= numberStart && state.todo.cursorColumn < numberEnd) {
      const deleteIndex = state.todo.cursorColumn - numberStart;
      editNumber(task, (digits) => `${digits.slice(0, deleteIndex)}${digits.slice(deleteIndex + 1)}`);
      state.dirty = true;
      ensureCursorVisible();
      render();
    }
  }

  function openDeleteConfirmation() {
    if (state.currentFile !== "todo") {
      setStatus("FATAL: TODO_COMPLETED.md is read-only.");
      return;
    }

    if (state.todo.tasks.length === 0) {
      setStatus("FATAL: No TODO line to delete.");
      return;
    }

    state.confirmDeleteOpen = true;
    render();
  }

  function closeDeleteConfirmation(message = null) {
    state.confirmDeleteOpen = false;
    if (message) {
      state.statusMessage = message;
    }
    render();
  }

  function deleteCurrentTask() {
    if (state.todo.tasks.length === 0) {
      closeDeleteConfirmation("FATAL: No TODO line to delete.");
      return;
    }

    const updated = state.todo.tasks.map((task) => ({ ...task }));
    updated.splice(state.todo.currentIndex, 1);
    const nextTaskId = updated[Math.min(state.todo.currentIndex, updated.length - 1)]?.id ?? null;
    state.confirmDeleteOpen = false;
    replaceTasks(updated, nextTaskId);
    if (updated.length === 0) {
      state.todo.currentIndex = 0;
      state.todo.cursorColumn = emptyTaskLine(0).length;
      state.todo.scrollOffset = 0;
    } else {
      state.todo.currentIndex = Math.min(state.todo.currentIndex, updated.length - 1);
      syncCursorToValidTask();
      ensureCursorVisible();
    }
    state.statusMessage = "Deleted current TODO line.";
    render();
  }

  function insertNewTask() {
    if (state.currentFile !== "todo") {
      return;
    }

    const committed = commitMissingPriorities(state.todo.tasks);
    const insertionIndex = state.todo.tasks.length === 0 ? 0 : state.todo.currentIndex + 1;
    const updated = committed.map((task) => ({ ...task }));
    const task = createTask("", null);
    updated.splice(insertionIndex, 0, task);
    updated.forEach((entry, index) => {
      entry.requestedPriority = String(index + 1);
    });
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
    loadWorkspace("Saved TODO.md.", { preservePosition: true });
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

    loadWorkspace("Reloaded from disk.", { preservePosition: true });
    render();
  }

  screen.on("keypress", (ch, key) => {
    if (state.quitting) {
      return;
    }

    if (state.confirmDeleteOpen) {
      if (key.name === "enter" || ch === "y" || ch === "Y") {
        deleteCurrentTask();
        return;
      }

      if (key.name === "escape" || ch === "n" || ch === "N") {
        closeDeleteConfirmation("Delete cancelled.");
        return;
      }

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

    if (key.ctrl && key.name === "l") {
      openDeleteConfirmation();
      return;
    }

    if ((key.ctrl && key.name === "j") || key.name === "enter" || ch === "\n") {
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

    if (ch) {
      insertCharacter(ch);
    }
  });

  function handleWheel(delta) {
    if (state.currentFile === "completed") {
      state.completed.scrollOffset += delta;
      clampCompletedScrollOffset();
      render();
      return;
    }

    moveVertical(delta);
  }

  screen.on("wheelup", () => {
    handleWheel(-3);
  });

  screen.on("wheeldown", () => {
    handleWheel(3);
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
