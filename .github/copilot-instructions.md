# Agent Guidelines

Always follow the 5 Steps principle:
1. Question every requirement.
2. Delete any unnecessary parts or processes.
3. Simplify and optimize.
4. Accelerate cycle time.
5. Automate.

Communicate with the user in Traditional Chinese.
Write code and comments in English.

If possible, provide more explanatory comments in the generated code to help humans understand what the code is doing.

After completing modifications, always provide an English commit message summarizing the changes.

When running Go module commands that need external network access, prefix the command with `http_proxy= https_proxy=` (for example, `http_proxy= https_proxy= go get ...`) to avoid proxy issues.
