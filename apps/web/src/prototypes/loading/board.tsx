import { Bone } from "./bone";

const LANES: { name: string; cards: [string, string][] }[] = [
  {
    name: "To do",
    cards: [
      ["Pick a venue feed vendor", "LIVE-139"],
      ["Draft the sponsor strip", "LIVE-141"],
      ["Audit referee app logins", "LIVE-144"],
      ["Plan the playoff bracket", "LIVE-150"],
    ],
  },
  {
    name: "In progress",
    cards: [
      ["Show halftime scores on the lobby TV", "LIVE-142"],
      ["Fix late score corrections", "LIVE-137"],
      ["Rotate the API keys", "LIVE-146"],
    ],
  },
  {
    name: "Done",
    cards: [
      ["Ship the match clock", "LIVE-128"],
      ["Name the lobby layouts", "LIVE-131"],
    ],
  },
];

/** Board stand-in: three lanes, fixed-height cards. */
export function Board() {
  return (
    <div className="flex h-full gap-3 overflow-x-auto overflow-y-hidden p-3 sm:p-4">
      {LANES.map((lane) => (
        <section key={lane.name} className="flex w-72 shrink-0 flex-col gap-2">
          <Bone className="h-6 w-28 rounded-sm">
            <h2 className="flex items-center gap-2 text-sm font-medium leading-6">
              {lane.name}
              <span className="text-xs text-muted-foreground">
                {lane.cards.length}
              </span>
            </h2>
          </Bone>
          {lane.cards.map(([title, key]) => (
            <div
              key={key}
              className="h-[78px] rounded-lg border border-border/80 bg-card p-3"
            >
              <div className="flex h-full flex-col justify-between">
                <Bone className="h-5 w-full rounded-sm">
                  <p className="truncate text-sm leading-5">{title}</p>
                </Bone>
                <div className="flex items-center justify-between">
                  <Bone className="h-4 w-16 rounded-sm">
                    <p className="text-xs leading-4 text-muted-foreground">
                      {key}
                    </p>
                  </Bone>
                  <Bone className="size-5 rounded-full">
                    <span className="block size-full rounded-full bg-muted" />
                  </Bone>
                </div>
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
