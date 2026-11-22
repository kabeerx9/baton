import { describe, expect, it } from "vite-plus/test";
import {
  digestMessage,
  unblockedMessage,
  waitingOnYouMessage,
  welcomeMessage,
  workspaceWelcomeMessage,
} from "./messages";

const api = { key: "API-3", title: "Return points", url: "https://t/api-3" };
const app = { key: "APP-2", title: "Show points", url: "https://t/app-2" };
const eng = { key: "ENG-1", title: "Emit events", url: "https://t/eng-1" };

describe("slack messages", () => {
  it("names the person who waits and links both tasks", () => {
    expect(
      waitingOnYouMessage({ waiterName: "Kabeer", blocker: api, blocked: app }),
    ).toBe(
      "*Kabeer is waiting on you*\n<https://t/api-3|API-3 Return points> blocks <https://t/app-2|APP-2 Show points>.",
    );
  });

  it("still reads well when the waiting task has no owner", () => {
    expect(
      waitingOnYouMessage({ waiterName: null, blocker: api, blocked: app }),
    ).toContain("*A task is waiting on you*");
  });

  it("says you can continue when nothing else blocks the task", () => {
    expect(
      unblockedMessage({ blocker: api, blocked: app, stillWaitingOn: [] }),
    ).toContain("*You can continue APP-2*");
  });

  it("lists what still blocks the task", () => {
    const text = unblockedMessage({
      blocker: api,
      blocked: app,
      stillWaitingOn: [eng],
    });
    expect(text).toContain("*API-3 is done*");
    expect(text).toContain(
      "still waits on <https://t/eng-1|ENG-1 Emit events>",
    );
  });

  it("counts blocking tasks, not links, in the digest", () => {
    const text = digestMessage(
      [
        { blocker: api, blocked: app, waiterName: "Kabeer" },
        { blocker: api, blocked: eng, waiterName: null },
      ],
      "https://t/my-tasks",
    );
    expect(text.startsWith("*Waiting on you: 1 task*")).toBe(true);
    expect(text).toContain("(Kabeer)");
    expect(text).toContain("<https://t/my-tasks|Open My tasks>");
  });

  it("escapes characters Slack treats as markup", () => {
    const text = waitingOnYouMessage({
      waiterName: "A & B",
      blocker: { ...api, title: "Fix <script> & co" },
      blocked: app,
    });
    expect(text).toContain("A &amp; B");
    expect(text).toContain("Fix &lt;script&gt; &amp; co");
  });

  it("welcomes a person who joined and names who shared the link", () => {
    expect(
      welcomeMessage({
        workspaceName: "R&D <Team>",
        sharerName: "Kabeer",
        boardUrl: "https://t/dashboard/workspace/ws-1/board",
      }),
    ).toBe(
      "Welcome to *R&amp;D &lt;Team&gt;* on Baton! Kabeer shared this workspace with you. Open your board: <https://t/dashboard/workspace/ws-1/board>",
    );
  });

  it("escapes the sharer's name", () => {
    expect(
      welcomeMessage({
        workspaceName: "Team",
        sharerName: "<!channel> & co",
        boardUrl: "https://t/b",
      }),
    ).toContain("&lt;!channel&gt; &amp; co shared this workspace with you.");
  });

  it("welcomes the owner of a new workspace by name", () => {
    expect(
      workspaceWelcomeMessage({
        name: "Kabeer",
        workspaceName: "R&D <Team>",
        boardUrl: "https://t/dashboard/workspace/ws-1/board",
      }),
    ).toBe(
      "*Welcome to Baton, Kabeer!*\n*R&amp;D &lt;Team&gt;* is ready. Open your board: <https://t/dashboard/workspace/ws-1/board>",
    );
  });

  it("welcomes without a name when the owner has none", () => {
    expect(
      workspaceWelcomeMessage({
        name: null,
        workspaceName: "Team",
        boardUrl: "https://t/b",
      }),
    ).toBe(
      "*Welcome to Baton!*\n*Team* is ready. Open your board: <https://t/b>",
    );
  });

  it.each([null, "  "])(
    "leaves out the sharer sentence for %j",
    (sharerName) => {
      expect(
        welcomeMessage({
          workspaceName: "Team",
          sharerName,
          boardUrl: "https://t/b",
        }),
      ).toBe("Welcome to *Team* on Baton! Open your board: <https://t/b>");
    },
  );
});
