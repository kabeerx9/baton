import { mergeAttributes, Node } from "@tiptap/core";

// Inline atom node for an @mention of a workspace member. Stores the member id
// (used by the backend to fire a notification) and a display label, and
// round-trips through Markdown as `<baton-mention id label></baton-mention>`,
// mirroring the BatonIssueLink extension.
export const BatonMention = Node.create({
  name: "batonMention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: {
        default: "",
        parseHTML: (el) =>
          el.getAttribute("id") || el.getAttribute("data-id") || "",
        renderHTML: (attrs) => ({ "data-id": attrs.id }),
      },
      label: {
        default: "",
        parseHTML: (el) =>
          el.getAttribute("label") || el.getAttribute("data-label") || "",
        renderHTML: (attrs) => ({ "data-label": attrs.label }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: "baton-mention[id]" },
      { tag: "span[data-type='baton-mention']" },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "baton-mention",
        class: "baton-mention",
      }),
      `@${node.attrs.label || ""}`,
    ];
  },

  renderText({ node }) {
    return `@${node.attrs.label || ""}`;
  },

  renderMarkdown(node: { attrs?: { id?: string; label?: string } }) {
    const id = String(node.attrs?.id || "");
    const label = String(node.attrs?.label || "");
    if (!id) return `@${label}`;
    return `<baton-mention id="${id}" label="${label}"></baton-mention>`;
  },
});
