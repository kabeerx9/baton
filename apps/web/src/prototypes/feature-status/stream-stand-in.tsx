/**
 * A grey stand-in for the task stream the real page shows under the hero, so
 * a variant is judged with what sits below it.
 */
export function StreamStandIn({ count }: { count: number }) {
  return (
    <section
      aria-hidden="true"
      className="mt-8 rounded-2xl border border-dashed p-4 text-muted-foreground text-xs"
    >
      <p className="mb-3 font-medium">
        Task stream and list (unchanged, shown below the hero)
      </p>
      <ul className="flex flex-col gap-2">
        {Array.from({ length: Math.min(count, 4) }, (_, i) => (
          <li key={i} className="h-9 rounded-xl bg-muted/60" />
        ))}
      </ul>
    </section>
  );
}
