import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Avatar } from "@/components/board/avatar";
import { ActivityIcon, describeChange } from "../../shared/activity-visual";
import { CommentComposer } from "../../shared/comment-composer";
import type { PageProps } from "../../page-props";

const SHOWN = 4;

/** The latest entries, newest first. A comment is a bubble; a change is a line. */
export function HandoffLatest({ task, viewer, dispatch }: PageProps) {
  const [all, setAll] = useState(false);
  const entries = all ? task.activity : task.activity.slice(0, SHOWN);
  const hidden = task.activity.length - entries.length;
  return (
    <section aria-label="Activity">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Latest</h2>
        <span className="text-xs text-muted-foreground">
          {task.activity.length}{" "}
          {task.activity.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      <CommentComposer
        dispatch={dispatch}
        author={viewer.person}
        className="mb-4"
      />
      <ol className="space-y-3">
        <AnimatePresence initial={false}>
          {entries.map((e) => (
            <motion.li
              key={e.id}
              layout="position"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              className="flex gap-3"
            >
              <Avatar person={e.actor} size={24} />
              <div className="min-w-0 flex-1 text-sm">
                {e.kind === "comment" ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      <b className="font-medium text-foreground">
                        {e.actor.name.split(" ")[0]}
                      </b>{" "}
                      · {e.at}
                    </p>
                    <p className="mt-1 rounded-2xl rounded-tl-md bg-muted px-3 py-2 leading-relaxed">
                      {e.body}
                    </p>
                  </>
                ) : (
                  <p className="flex items-center gap-1.5 pt-0.5 text-muted-foreground">
                    <ActivityIcon kind={e.kind} className="size-3.5 shrink-0" />
                    <span className="truncate">
                      <b className="font-medium text-foreground">
                        {e.actor.name.split(" ")[0]}
                      </b>{" "}
                      {describeChange(e)}
                    </span>
                    <span className="ml-auto shrink-0 text-xs">{e.at}</span>
                  </p>
                )}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="mt-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Show {hidden} older
        </button>
      )}
    </section>
  );
}
