import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useState } from "react";

const EASE = [0.23, 1, 0.32, 1] as const;

/** A section that starts closed unless `defaultOpen` is set. Content mounts while open. */
export function Disclosure({
  title,
  hint,
  children,
  defaultOpen = false,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-border border-t">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 py-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="font-medium">{title}</span>
        {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
        <ChevronDown
          className={`ml-auto size-4 text-muted-foreground transition-transform duration-200 ease-out ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
