#!/bin/bash
#
# Pre-push hook: Run lint:fix before git push
# Blocks push if there are unresolved lint errors
#

# Read the tool input from stdin
INPUT=$(cat)

# Extract the command being executed
COMMAND=$(echo "$INPUT" | grep -o '"command":"[^"]*"' | sed 's/"command":"//;s/"$//')

# Only run lint check for git push commands
if [[ "$COMMAND" == *"git push"* ]]; then
  echo "Running lint:fix before push..." >&2

  # Change to project directory
  cd "$CLAUDE_PROJECT_DIR" || exit 2

  # Run lint:fix
  npm run lint:fix 2>&1
  LINT_EXIT_CODE=$?

  if [ $LINT_EXIT_CODE -ne 0 ]; then
    echo "" >&2
    echo "========================================" >&2
    echo "PUSH BLOCKED: Lint errors detected!" >&2
    echo "Please fix all lint errors before pushing." >&2
    echo "========================================" >&2
    exit 2  # Exit code 2 blocks the action
  fi

  echo "Lint check passed!" >&2
fi

exit 0
