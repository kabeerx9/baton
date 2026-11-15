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
| Involved | The task's creator and its assignee. With no creator, only the assignee; with neither, nobody. |
| Change request | A status change or delete asked for by someone who is not involved. It waits for an answer. |
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
7. Only involved people, workspace owners and admins change a task's status,
   delete it or reassign it directly. Other members ask: see the table below.
   Every check runs on the locked task row in the API
   (`apps/api/src/task-change-request/consent.ts`), not in the UI.

### Who can change a task

The permission check always comes first: a status change needs `task:update`,
a direct delete needs `task:delete`, a reassignment needs `task:assign`. An
API key narrows each permission to its scope. The check runs on every path
that changes the owner: the assignee route, a full update, the board item
update and a move that drops the owner. Then:

| Change | Involved, owner or admin | Other member |
| --- | --- | --- |
| Status | Applies | Change request (202) |
| Delete | Applies (needs `task:delete`) | Change request (202), needs `task:update` |
| Assign, unassign | Applies | Refused (403). This includes taking the task yourself. |
| Title, description, priority, due date, labels | Applies | Applies; involved people get a notification |
| Status of a feature (rule 3) | Applies | Applies, except archive and unarchive: a change request that expires |

- Bulk, reorder and project move never create a request. They refuse the
  item instead: bulk returns `results` per task, reorder across columns returns
  409, a move that changes the status returns 409.
- Answering: an involved person, owner or admin with the action's permission
  (`task:update` for a status request, `task:delete` for a delete request)
  accepts or rejects. Nobody answers their own request. Only the requester
  cancels (withdraws) it. `canAnswer=me` uses the same rule.
- A repeat of a recorded decision by the same person returns the recorded
  result. Anyone else, or a different decision, gets 409.
- Reading a request does not let you read its task. Accept, reject and cancel
  return `task: null` unless the caller can read the task now (membership,
  `task:read`, project access, and the task's current workspace is not
  archived).
- One pending request per task. A second request from anyone supersedes it;
  the same request again returns the existing one. At most 10 new requests
  per workspace per hour (429).
- Accept and the timeout re-check the task and the requester. The request ends
  `cancelled` with the reason if the task status or project changed, the task
  became a feature, the requester lost access or is banned
  (`requester_lost_access`), the
  workspace was archived (`workspace_archived`), or the API key that made the
  request was disabled, expired, deleted or no longer allows the change
  (`credential_revoked`). The request stores the key id, never the secret; a
  request from a session re-checks only the person. A blocked task still
  cannot be finished (rule 5); that refusal also ends the request
  `cancelled`.
- No answer in 24 hours: a status request into a non-final, non-archived
  column applies (`applied_on_timeout`, credited to the requester). A request
  for a final column, archive, unarchive or a delete expires. The hourly job is
  `apps/api/src/task-change-request/expire-change-requests.ts`; it runs safely
  on several instances at once.
- Any direct status change, reassignment, move or delete cancels the pending
  request. Exception: GitHub and other system writers do not check rule 5,
  because GitHub is the source of truth. They still cancel the pending request
  (`applyTaskChange` in `apps/api/src/task-change-request/apply-task-change.ts`).
- Every path that cancels a request notifies the requester after commit. If
  the task is gone or hidden, the notice falls back to the workspace. There
  are no database triggers. A history notice sends no Slack link, so it does
  not show where a moved or hidden task is now.
- Lock order: workspaces (FOR SHARE, by id), then projects, then the
  requester's hourly quota (an advisory lock), then tasks sorted by id, then
  requests. Workspace archive and delete lock the workspace first, so they
  never deadlock with a request. Paths that open a request use
  `withLockedProjectTask` in `apps/api/src/task/controllers/with-locked-task.ts`;
  accept and the timeout use `lockWorkspacesShared` in
  `apps/api/src/task-change-request/lock-workspaces.ts`.

States: `pending`, then one of `accepted`, `rejected`, `cancelled`,
`superseded`, `expired`, `applied_on_timeout`. The transitions are one pure
function, `apps/api/src/task-change-request/lifecycle.ts`. An unknown state is
treated as final.

## Storage

- Tasks are ordinary `task` rows. Nothing about comments, activity or assignees is new.
- Each workspace has one hidden project with `project.kind = 'board'`. Board tasks are
  its top-level tasks. The API creates it on first use and never lists it with the repos.
- A subtask is a `task_relation` of type `subtask`: source = the task, target = the subtask.
- A subtask with no repo is stored in the board project. The UI labels it "No repo".
- "Waits on" is a `task_relation` of type `blocks`: source = the blocker.
- `task.created_by` is the creator. Migration 0077 filled it from each task's
  earliest `created` activity; tasks without one have no creator.
- `task.status_generation` goes up by one on every status change. A request
  stores the status and generation it saw, so accept can detect a change.
- `task_change_request` keeps every request. It copies the task key and title,
  so it keeps its history after the task is deleted.
- `activity.channel` is `web` (cookie session) or `agent` (bearer token, API
  key, MCP). Null for system writes and older rows.

## API

| Call | Purpose |
| --- | --- |
| `GET /api/board/workspace/{workspaceId}` | The whole board in one response. Each item has `column` (todo, doing, review, done), `dueDate`, `finishedAt`, `waitsOn` and `hiddenBlockers`. |
| `POST /api/board/workspace/{workspaceId}` | Create a task. |
| `POST /api/board/{taskId}/subtask` | Create a subtask and link it, in one transaction. |
| `GET /api/board/workspace/{workspaceId}/history?days=30` | Finished work per person. |
| `GET /api/task/assigned?workspaceId=` | My open work. `waiting` lists the open tasks each one blocks; `waitsOn` and `hiddenBlockers` say what each one waits on. |
| `GET /api/task-change-request?workspaceId=` | Change requests, newest first. Filters: `taskId`, `state`, `requestedBy=me`, `canAnswer=me`. |
| `GET /api/task-change-request/{id}` | One request. Works after the task is deleted. |
| `POST /api/task-change-request/{id}/accept`, `/reject`, `/cancel` | Answer or withdraw a request. Returns `{ request, task }`; `request.state` says how it ended. |

Status, delete, full task update and board item update answer 200 with
`outcome: "applied"`, or 202 with `outcome: "requested"` and the `request`.
The task routes answer `{ outcome, task }`. The board item update keeps the
flat board item and adds `outcome` (and `request`) beside its fields; this is
the board contract.
Clients read `outcome`, not only the HTTP status. The board, task detail and
my tasks show `pendingRequest` (or null) on each item.

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
The endpoint lists a core set by default; `?tools=all` (or `BATON_MCP_TOOLS=all`
for stdio) lists the full catalog. The core set lives in
`packages/mcp/src/tools/catalog.ts`.

| Tool | Core | Use |
| --- | --- | --- |
| `list_workspaces` | yes | The workspaces the caller can read. |
| `list_my_tasks` | yes | The caller's open work, with who waits on each item. |
| `get_task_by_ticket_id` | yes | One task by key, with its comments, in one call. |
| `get_board` | yes | Everything in one call: tasks, subtasks, keys, repos, members. |
| `create_board_task` | yes | One call creates a task with its description, owner, subtasks, their repos and owners, and what waits on what. |
| `add_subtasks` | yes | Adds subtasks to a task found by its key. |
| `update_board_item` | yes | Sets the status, owner or waits-on of a task or subtask found by its key. |
| `create_task_comment` | yes | Adds a comment to a task. |
| `list_workspace_members` | yes | Members, for names and ids. |
| `list_change_requests` | yes | Change requests in a workspace; `canAnswer: true` for those waiting on the caller. |
| `answer_change_request` | yes | Accept or reject a request. |
| `cancel_change_request` | yes | Withdraw your own request. |
| `get_team_history` | no | Finished work per person. |
| `get_change_request` | no | One request and how it ended. |

Board tools take `workspaceId` as an id or a name, and it is optional. The
workspace is the one named, else the grant's default (chosen on the consent
page), else the caller's only workspace. Otherwise the error lists the valid
names. Resolution lives in `packages/mcp/src/tools/resolve-workspace.ts`.

The status, delete and update tools return `outcome`. An agent reports
`requested` as waiting for an answer, not as done. The server sends this
recipe as its MCP `instructions` (`packages/mcp/src/tools/instructions.ts`).

A wrong name creates nothing: every name is checked first, and the error lists the valid ones.
The task tools still apply to any task or subtask id, for titles, descriptions and comments.
The matching API calls are `POST /api/board/workspace/{id}/plan`,
`POST /api/board/workspace/{id}/item/{key}/subtasks` and `PATCH /api/board/workspace/{id}/item/{key}`.
Name matching lives in `apps/api/src/board/resolve-names.ts`.

### Who an agent is

`/api/mcp` accepts an MCP access token or an API key, never a browser
session token. An MCP token belongs to a grant (`mcp_grant`): one connected
agent, its user, client and default workspace. Tokens are stored as SHA-256
hashes (`mcp_token`). Access tokens last one hour; refresh tokens rotate, and
a rotated token still works for 60 seconds so two processes of one agent can
refresh together. A rotated token used later revokes the grant. A grant ends
after 90 days without use, on `DELETE /api/mcp/grants/{id}`, on a password
reset, a ban, deactivation or account deletion. Signing out sessions does not
end grants. The refresh rule is one pure function,
`apps/api/src/mcp/grant/refresh-decision.ts`.

An MCP token also works on the REST API, because the tools call it, and acts
with the person's permissions (`activity.channel` is `agent`). It never works
on `/api/auth/*`, session-only routes or WebSockets.

## Slack messages

Optional. Set `SLACK_BOT_TOKEN` to turn them on; see `.env.sample`. Code: `apps/api/src/slack-dm`.

| Message | Sent to | When |
| --- | --- | --- |
| "X is waiting on you" | The owner of the blocking task | A task is linked as blocked by theirs, or a blocking task is reassigned to them |
| "You can continue" | The owner of the blocked task | A task that blocked theirs is finished |
| "Waiting on you: N tasks" | Each person whose open tasks block open work | Once a day, only if the list is not empty |
| "X asks to move T-5 to done" | The involved people | A change request is made. With nobody involved, admins find it with `canAnswer=me`. |
| "Your request was accepted" (or rejected, cancelled, expired) | The requester | Their request ends, unless they ended it |

Change request messages are also in-app notifications, sent after the change commits.

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
