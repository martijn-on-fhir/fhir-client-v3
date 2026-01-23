---
name: typescript-linter
description: Analyzes TypeScript code for issues and suggests improvements
tools: Read, Glob, Grep
model: sonnet
hooks:
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "npx eslint --fix $FILE"
---

You are a TypeScript specialist. Analyze code for type safety,
best practices, and potential runtime errors.
```

## Gebruik

Claude roept subagents automatisch aan op basis van de `description`, of je kunt expliciet vragen:
```
Use the code-reviewer agent to analyze this function
