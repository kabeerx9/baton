# The board model

Baton is based on Kaneo and changes how it is used. Read this before you touch `apps/api/src/board`,
`apps/web/src/components/board`, or the board tools in `packages/mcp`.

## Words

| Word | Meaning |
| --- | --- |
| Task | One job with one owner. "Fix login crash" is a task. |
| Feature | A job that has tasks under it. "Live scoring" is a feature; its app work and its API work are tasks. |
| Board | The home page. It lists every feature and every task that stands alone. |
| Task page | The one page for any task or feature. |
| Repo | What the code calls a project: App, API, Draft engine. A task under a feature lives in a repo and gets its key prefix, for example `API-3`. A task with no repo, or one that stands alone, gets `T`. |

Everything you do is a task, and a feature is a group of tasks. An item is called a
feature exactly while it has tasks under it; nothing is stored for this
(`kindOf` in `apps/web/src/components/board/model.ts`).

The UI never says "subtask" or "project". The code and the API still say `subtask`
for a task under a feature, and `board task` for an item on the board.

## Rules

1. One task has one owner. A piece for another person is another task under the feature.
2. A task uses its own status.
3. A feature ignores its own status. Its column comes from its tasks:
   done when all are done, in review when every unfinished one is in review,
   in progress once one has started. A task with no tasks under it uses its
   own status: to do, in progress, in review or done. See
   `apps/api/src/board/controllers/board-column.ts`.
4. A task under a feature cannot have tasks under it. The board is two levels deep.
5. A task that is blocked by an open task cannot be marked done. It can be started.
   A blocker is open while it is not done; a feature is open while one of its
   tasks is open (rule 3). An archived blocker, or one in an archived repo, never
   blocks. Blocked is a signal, not a column: a blocked item stays where it is.
   A waits-on link that would close a loop of any length (A > B > C > A) is
   refused with 409 (`apps/api/src/task-relation/assert-no-blocks-cycle.ts`).
   The open rule is `taskIsOpen` in `apps/api/src/board/open-board-task.ts`; the
   refusal is `apps/api/src/task/assert-not-blocked.ts`.
6. My tasks follows rule 3: a feature is open while one of its tasks is open.
   See `apps/api/src/board/open-board-task.ts`.

## Storage

- Tasks are ordinary `task` rows. Nothing about comments, activity or assignees is new.
- Each workspace has one hidden project with `project.kind = 'board'`. Board tasks are
  its top-level tasks. The API creates it on first use and never lists it with the repos.
- A subtask is a `task_relation` of type `subtask`: source = the task, target = the subtask.
- A subtask with no repo is stored in the board project. The UI labels it "No repo".
- "Waits on" is a `task_relation` of type `blocks`: source = the blocker.

## API

| Call | Purpose |
| --- | --- |
| `GET /api/board/workspace/{workspaceId}` | The whole board in one response. Each item has `column` (todo, doing, review, done), `dueDate`, `finishedAt`, `waitsOn` and `hiddenBlockers`. |
| `POST /api/board/workspace/{workspaceId}` | Create a task. |
| `POST /api/board/{taskId}/subtask` | Create a subtask and link it, in one transaction. |
| `GET /api/board/workspace/{workspaceId}/history?days=30` | Finished work per person. |
| `GET /api/task/assigned?workspaceId=` | My open work. `waiting` lists the open tasks each one blocks; `waitsOn` and `hiddenBlockers` say what each one waits on. |

What a task waits on comes from the server, in one module
(`apps/api/src/task/get-open-blockers.ts`):

- `waitsOn` lists the open blockers the caller can see, in any repo or feature.
- `hiddenBlockers` counts open blockers in repos the caller cannot see. A
  top-level board task is always visible to workspace members, as on the board. Nothing
  else about them is sent, and the refusal to finish names them only as a count.
- An item is blocked when `waitsOn` is not empty or `hiddenBlockers` is above 0.
  `blockedBy` on a subtask is edges for the feature map only.
- `finishedAt` is the time the item reached its current final status, the same
  time team history uses (`apps/api/src/task/finished-at.ts`).

Status, assignee, description and comments use the normal task endpoints.

## MCP tools

Agents work in names, not ids: owner "Aakash", repo "API", key "T-5".

| Tool | Use |
| --- | --- |
| `get_board` | Everything in one call: tasks, subtasks, keys, repos, members. |
| `create_board_task` | One call creates a task with its description, owner, subtasks, their repos and owners, and what waits on what. |
| `add_subtasks` | Adds subtasks to a task found by its key. |
| `update_board_item` | Sets the status, owner or waits-on of a task or subtask found by its key. |
| `list_my_tasks` | The caller's open work, with who waits on each item. |
| `get_team_history` | Finished work per person. |

A wrong name creates nothing: every name is checked first, and the error lists the valid ones.
The task tools still apply to any task or subtask id, for titles, descriptions and comments.
The matching API calls are `POST /api/board/workspace/{id}/plan`,
`POST /api/board/workspace/{id}/item/{key}/subtasks` and `PATCH /api/board/workspace/{id}/item/{key}`.
Name matching lives in `apps/api/src/board/resolve-names.ts`.

## Slack messages

Optional. Set `SLACK_BOT_TOKEN` to turn them on; see `.env.sample`. Code: `apps/api/src/slack-dm`.

| Message | Sent to | When |
| --- | --- | --- |
| "X is waiting on you" | The owner of the blocking task | A task is linked as blocked by theirs, or a blocking task is reassigned to them |
| "You can continue" | The owner of the blocked task | A task that blocked theirs is finished |
| "Waiting on you: N tasks" | Each person whose open tasks block open work | Once a day, only if the list is not empty |

- A person is matched to Slack by the email of their tracker account. The answer is saved
  in `slack_user_link`. `PUT /api/slack-dm/me` sets a Slack member ID by hand.
- Nobody is messaged about their own action or about blocking their own task.
- A Slack failure is logged and never fails the task change.
- `POST /api/slack-dm/me/test` sends the caller a test message and returns the outcome.

## What was removed from upstream

This fork is not kept in step with upstream. These parts were deleted on 2026-11-13:

- The marketing site, the docs site, the mobile app and the CLI package.
- Upstream's GitHub workflows, release tooling, Helm chart and CI scripts.
- The per-repo screens: repo board, list, backlog, calendar and Gantt. Their URLs now
  redirect to the board, or to the task they name.

These server parts were deleted on 2026-11-14, with their tables and columns:

- Billing and trials (Creem), importers (Trello, Planka and others), the calendar feed,
  time tracking, recurring tasks, custom fields and the public project page.
- Chat integrations other than Slack DMs (Discord, Telegram, Mattermost, generic
  webhook, Slack channel posts), and the Gitea and GitLab integrations.
- Every sign-in method except email and password: guest mode, email codes, magic links,
  OIDC and social sign-in, CLI device login and captcha. GitHub can only be linked to an
  account that is already signed in, to connect repos.
- Translations. Emails, notifications and the UI are English only.

A repo is managed on the Repos page (`/projects`). It has no board of its own.
