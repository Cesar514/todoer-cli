const {
  getCompletedFilePath,
  getTodoFilePath,
  readTaskFileContents,
  readTaskFiles,
  serializeCompletedFile,
  serializeTodoFile,
  validateTaskFileContents,
  writeFileAtomically,
} = require("./task-files");
const { expandTaskText } = require("./ollama");

function normalizePendingTasks(tasks) {
  return tasks.map((task, index) => ({
    priority: index + 1,
    text: task.text,
  }));
}

function assertTaskText(text) {
  if (!text || !text.trim()) {
    throw new Error("Task text is required");
  }
}

function assertPriorityInRange(priority, tasks) {
  if (!Number.isInteger(priority) || priority < 1 || priority > tasks.length) {
    throw new Error(`Priority ${priority} is out of range`);
  }
}

function getState(rootDir) {
  return readTaskFiles(rootDir);
}

function saveState(rootDir, tasks, completed) {
  writeFileAtomically(getTodoFilePath(rootDir), serializeTodoFile(tasks));
  writeFileAtomically(getCompletedFilePath(rootDir), serializeCompletedFile(completed));
}

function readWorkspace(rootDir) {
  const raw = readTaskFileContents(rootDir);

  try {
    const parsed = validateTaskFileContents(raw);
    return { ...raw, ...parsed, isValid: true, error: null };
  } catch (error) {
    return { ...raw, tasks: [], completed: [], isValid: false, error };
  }
}

function validateWorkspaceContents(rootDir, todoContent, completedContent) {
  return validateTaskFileContents({
    todoContent,
    completedContent,
    todoPath: getTodoFilePath(rootDir),
    completedPath: getCompletedFilePath(rootDir),
  });
}

function writeWorkspaceContents(rootDir, todoContent, completedContent) {
  const parsed = validateWorkspaceContents(rootDir, todoContent, completedContent);
  writeFileAtomically(getTodoFilePath(rootDir), todoContent);
  writeFileAtomically(getCompletedFilePath(rootDir), completedContent);
  return parsed;
}

function addTask(rootDir, text, requestedPriority) {
  assertTaskText(text);
  const { tasks, completed } = readTaskFiles(rootDir);
  const nextPriority = requestedPriority === undefined ? tasks.length + 1 : requestedPriority;

  if (!Number.isInteger(nextPriority) || nextPriority < 1 || nextPriority > tasks.length + 1) {
    throw new Error(`Priority ${nextPriority} is out of range`);
  }

  const updatedTasks = [...tasks];
  updatedTasks.splice(nextPriority - 1, 0, { priority: nextPriority, text: text.trim() });
  saveState(rootDir, normalizePendingTasks(updatedTasks), completed);
}

function removeTask(rootDir, priority) {
  const { tasks, completed } = readTaskFiles(rootDir);
  assertPriorityInRange(priority, tasks);

  const updatedTasks = tasks.filter((task) => task.priority !== priority);
  saveState(rootDir, normalizePendingTasks(updatedTasks), completed);
}

function reprioritizeTask(rootDir, priority, newPriority) {
  const { tasks, completed } = readTaskFiles(rootDir);
  assertPriorityInRange(priority, tasks);

  if (!Number.isInteger(newPriority) || newPriority < 1 || newPriority > tasks.length) {
    throw new Error(`New priority ${newPriority} is out of range`);
  }

  const updatedTasks = [...tasks];
  const [task] = updatedTasks.splice(priority - 1, 1);
  updatedTasks.splice(newPriority - 1, 0, task);
  saveState(rootDir, normalizePendingTasks(updatedTasks), completed);
}

function completeTask(rootDir, priority, timestamp) {
  const { tasks, completed } = readTaskFiles(rootDir);
  assertPriorityInRange(priority, tasks);

  if (!timestamp.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)) {
    throw new Error(`Invalid completion timestamp: ${timestamp}`);
  }

  const task = tasks[priority - 1];
  const updatedTasks = tasks.filter((entry) => entry.priority !== priority);
  const updatedCompleted = [{ timestamp, text: task.text }, ...completed];
  saveState(rootDir, normalizePendingTasks(updatedTasks), updatedCompleted);
}

async function expandTask(rootDir, priority) {
  const { tasks, completed } = readTaskFiles(rootDir);
  assertPriorityInRange(priority, tasks);

  const updatedTasks = [...tasks];
  updatedTasks[priority - 1] = {
    priority,
    text: await expandTaskText(updatedTasks[priority - 1].text),
  };

  saveState(rootDir, normalizePendingTasks(updatedTasks), completed);
}

function lintTaskFiles(rootDir) {
  readTaskFiles(rootDir);
}

module.exports = {
  addTask,
  completeTask,
  expandTask,
  getState,
  lintTaskFiles,
  readWorkspace,
  removeTask,
  reprioritizeTask,
  validateWorkspaceContents,
  writeWorkspaceContents,
};
