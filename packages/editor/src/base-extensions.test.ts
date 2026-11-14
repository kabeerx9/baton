import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createBaseExtensions } from "./base-extensions";
import { BatonMention } from "./baton-mention";

const MARKDOWN = [
  "# Release notes",
  "",
  'Ping <baton-mention id="user-1" label="Ada"></baton-mention> about this.',
  "",
  "",
  '<baton-attachment url="https://baton.example.com/files/report.pdf" filename="report.pdf" mime-type="application/pdf" size="2048" />',
  "",
  "",
  "Related work:",
  "",
  "",
  '<baton-issue-link url="https://baton.example.com/dashboard/workspace/w1/project/p1/task/t1" issue-key="KAN-1" task-id="t1" />',
  "",
  "",
  "Demo:",
  "",
  "",
  '<baton-embed url="https://www.youtube.com/watch?v=abc123" mode="embed" />',
  "",
  "",
  '<img src="https://baton.example.com/diagram.png" alt="Diagram" width="320" />',
  "",
  "- [ ] Draft",
  "- [x] Review",
  "",
  "",
  "| Name  | Status |",
  "| ----- | ------ |",
  "| Board | Done   |",
  "",
].join("\n");

let editor: Editor | null = null;

function createEditor() {
  editor = new Editor({
    extensions: createBaseExtensions({
      placeholder: "Write something",
      extra: [BatonMention],
    }),
  });
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("createBaseExtensions", () => {
  it("round-trips Baton markdown without changes", () => {
    const instance = createEditor();
    instance.commands.setContent(MARKDOWN, { contentType: "markdown" });

    expect(
      instance
        .getJSON()
        .content?.map((node) => node.content?.[0]?.type ?? node.type),
    ).toEqual([
      "text",
      "text",
      "attachmentCard",
      "text",
      "batonIssueLink",
      "text",
      "embedBlock",
      "image",
      "taskItem",
      "tableRow",
    ]);
    expect(instance.getMarkdown()).toBe(MARKDOWN);
  });

  it("serializes custom node attributes into markdown", () => {
    const instance = createEditor();
    instance.commands.setContent({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "attachmentCard",
              attrs: {
                url: "https://baton.example.com/files/report.pdf",
                filename: "report.pdf",
                mimeType: "application/pdf",
                size: 2048,
              },
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "batonIssueLink",
              attrs: {
                url: "https://baton.example.com/task/t1",
                issueKey: "KAN-1",
                taskId: "t1",
              },
            },
          ],
        },
      ],
    });

    expect(instance.getMarkdown()).toBe(
      [
        "",
        '<baton-attachment url="https://baton.example.com/files/report.pdf" filename="report.pdf" mime-type="application/pdf" size="2048" />',
        "",
        "",
        "",
        '<baton-issue-link url="https://baton.example.com/task/t1" issue-key="KAN-1" task-id="t1" />',
        "",
      ].join("\n"),
    );
  });
});
