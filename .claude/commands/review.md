---
description: Perform a code review on staged or recent changes
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(git log:*)
---

# Code Review

## Context

Current git status:
```
!`git status --short`
```

Staged changes:
```
!`git diff --cached --stat`
```

Recent commits (last 3):
```
!`git log --oneline -3`
```

## Your Task

Perform a thorough code review on the current changes. Review either:
1. **Staged changes** (if any files are staged)
2. **Unstaged changes** (if nothing is staged)
3. **Specific files** if provided as argument: $ARGUMENTS

## Review Checklist

Please analyze the code for:

### Code Quality
- [ ] Clean, readable code
- [ ] Proper naming conventions
- [ ] No code duplication
- [ ] Functions/methods are focused and not too long

### Best Practices
- [ ] Follows Angular/TypeScript best practices
- [ ] Proper error handling
- [ ] No console.log statements left in production code
- [ ] No commented-out code

### Security
- [ ] No hardcoded secrets or credentials
- [ ] Input validation where needed
- [ ] No SQL injection or XSS vulnerabilities

### Performance
- [ ] No obvious performance issues
- [ ] Efficient algorithms and data structures
- [ ] No memory leaks (subscriptions unsubscribed, etc.)

### Testing
- [ ] Code is testable
- [ ] Edge cases considered

## Output Format

Provide your review in this format:

### Summary
Brief overview of the changes

### Issues Found
List any problems that should be fixed before committing

### Suggestions
Optional improvements that could be made

### Verdict
- APPROVE - Ready to commit/push
- REQUEST CHANGES - Issues must be fixed first
