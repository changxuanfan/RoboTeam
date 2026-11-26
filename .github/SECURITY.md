# Security

## Reporting a problem

Please report security problems privately, not in a public issue: open the repository's
**Security** tab and choose **Report a vulnerability**. Only the maintainers see the report.

Say what is affected, how to reproduce it, and what an attacker could do with it. We will
reply in the report.

## What counts

Agents in RoboTeam write and run their own code, so the boundaries around that code matter most:

- a way out of the sandbox or the policy environment that the agents' code runs in;
- a way for an agent to read files, credentials or the ground truth it should not see, or to
  reach the evaluator;
- credentials from `.env` reaching a log, a run folder, an evidence file or a model;
- a way to change a run's score other than by completing the task.

A model that does badly on a task, or a bug in a task's physics, is not a security problem:
please open an ordinary issue for those.

## Supported versions

Only the latest commit on `main` is supported.
