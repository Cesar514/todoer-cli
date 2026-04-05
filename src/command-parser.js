function tokenize(input) {
  const tokens = [];
  let current = "";
  let quote = null;
  let escaping = false;

  for (const char of input.trim()) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (escaping) {
    throw new Error("Command ends with an unfinished escape");
  }

  if (quote) {
    throw new Error("Command has an unmatched quote");
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function parseInteger(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${label} must be an integer`);
  }
  return parsed;
}

function parseCommand(input) {
  const tokens = tokenize(input);
  if (tokens.length === 0) {
    throw new Error("Command is required");
  }

  const [name, ...rest] = tokens;

  if (name === "help" || name === "list" || name === "tasks" || name === "completed" || name === "write" || name === "reload" || name === "discard" || name === "quit") {
    if (rest.length > 0) {
      throw new Error(`${name} does not take arguments`);
    }
    return { name };
  }

  if (name === "open" || name === "edit") {
    if (rest.length !== 1 || !["todo", "completed"].includes(rest[0])) {
      throw new Error(`${name} requires exactly one target: todo or completed`);
    }
    return { name, target: rest[0] };
  }

  if (name === "remove" || name === "done" || name === "expand") {
    if (rest.length !== 1) {
      throw new Error(`${name} requires exactly one priority`);
    }
    return { name, priority: parseInteger(rest[0], "Priority") };
  }

  if (name === "reprioritize") {
    if (rest.length !== 2) {
      throw new Error("reprioritize requires current and new priority");
    }
    return {
      name,
      priority: parseInteger(rest[0], "Priority"),
      newPriority: parseInteger(rest[1], "New priority"),
    };
  }

  if (name === "add") {
    let priority;
    let expand = false;
    const textTokens = [];

    for (let index = 0; index < rest.length; index += 1) {
      const token = rest[index];
      if (token === "--priority") {
        if (priority !== undefined) {
          throw new Error("Priority can only be set once");
        }
        index += 1;
        if (index >= rest.length) {
          throw new Error("--priority requires a value");
        }
        priority = parseInteger(rest[index], "Priority");
        continue;
      }

      if (token === "--expand") {
        expand = true;
        continue;
      }

      textTokens.push(token);
    }

    const text = textTokens.join(" ").trim();
    if (!text) {
      throw new Error("add requires task text");
    }

    return { name, text, priority, expand };
  }

  throw new Error(`Unknown command: ${name}`);
}

module.exports = {
  parseCommand,
  tokenize,
};
