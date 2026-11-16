import { SendHorizontalIcon } from "lucide-react";
import { type Dispatch, useState } from "react";
import { Avatar } from "@/components/board/avatar";
import type { TaskAction } from "../task-state";
import type { Person } from "../types";

/** A comment box. ⌘/Ctrl+Enter sends. The box grows with the text. */
export function CommentComposer({
  dispatch,
  author,
  placeholder = "Write a comment…",
  className = "",
}: {
  dispatch: Dispatch<TaskAction>;
  author: Person;
  placeholder?: string;
  className?: string;
}) {
  const [body, setBody] = useState("");
  const send = () => {
    if (!body.trim()) return;
    dispatch({ type: "comment", body, author });
    setBody("");
  };
  return (
    <form
      className={`group flex items-start gap-2.5 rounded-xl border border-border bg-card p-2.5 transition-[border-color,box-shadow] duration-150 focus-within:border-foreground/25 focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-foreground)_6%,transparent)] ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <Avatar person={author} size={24} />
      <textarea
        aria-label="Comment"
        value={body}
        rows={1}
        placeholder={placeholder}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
          }
        }}
        className="field-sizing-content max-h-40 min-h-6 flex-1 resize-none bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        disabled={!body.trim()}
        aria-label="Send comment"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-foreground text-background transition-[opacity,scale] duration-150 ease-out active:scale-[0.94] disabled:scale-90 disabled:opacity-0"
      >
        <SendHorizontalIcon className="size-3.5" aria-hidden="true" />
      </button>
    </form>
  );
}
