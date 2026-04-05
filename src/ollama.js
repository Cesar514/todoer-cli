const childProcess = require("node:child_process");

const OLLAMA_MODEL = "nemotron-3-nano:4b-128k";

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function expandTaskText(taskText) {
  if (!taskText || !taskText.trim()) {
    throw new Error("Cannot expand an empty task");
  }

  const prompt = [
    "Rewrite the following TODO task as one detailed single-paragraph task.",
    "Keep the response to 250 words or fewer.",
    "Return only the rewritten task text.",
    "",
    taskText.trim(),
  ].join("\n");

  const child = childProcess.spawn("ollama", ["run", OLLAMA_MODEL, prompt], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", (error) => {
      reject(new Error(`Failed to start ollama: ${error.message}`));
    });
    child.on("close", resolve);
  });

  if (exitCode !== 0) {
    throw new Error(`ollama run failed with status ${exitCode}: ${(stderr || "unknown error").trim()}`);
  }

  const output = stdout.trim();
  if (!output) {
    throw new Error("ollama returned an empty expansion");
  }

  if (countWords(output) > 250) {
    throw new Error("ollama returned more than 250 words for the expanded task");
  }

  return output;
}

module.exports = {
  OLLAMA_MODEL,
  expandTaskText,
};
