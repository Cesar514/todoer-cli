const { lintTaskFiles } = require("./task-service");

try {
  lintTaskFiles(process.cwd());
  console.log("TODO.md and TODO_COMPLETED.md are valid.");
} catch (error) {
  console.error(`FATAL: ${error.message}`);
  process.exit(1);
}
