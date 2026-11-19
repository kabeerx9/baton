import { Bone } from "./bone";

const ACTIVITY = [
  ["Maya Chen", "Moved this to In progress."],
  ["Dev Patel", "Waiting on the venue feed key."],
  ["Maya Chen", "Added the halftime layout mock."],
];

/** Task detail stand-in. Every line is one line, so the skeleton matches. */
export function TaskDetail() {
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-5 overflow-hidden px-4 pb-10 pt-6 sm:px-6">
      <div className="flex flex-col gap-2.5">
        <Bone className="h-4 w-24 rounded-sm">
          <p className="text-xs font-medium text-muted-foreground">LIVE-142</p>
        </Bone>
        <Bone className="h-9 w-full rounded-md">
          <h1 className="truncate text-2xl font-semibold leading-9">
            Show halftime scores on the lobby TV
          </h1>
        </Bone>
        <div className="flex gap-2">
          <Bone className="h-6 w-24 rounded-md">
            <span className="flex h-full items-center rounded-md border border-border px-2 text-xs">
              In progress
            </span>
          </Bone>
          <Bone className="h-6 w-28 rounded-md">
            <span className="flex h-full items-center rounded-md border border-border px-2 text-xs">
              Maya Chen
            </span>
          </Bone>
          <Bone className="h-6 w-20 rounded-md">
            <span className="flex h-full items-center rounded-md border border-border px-2 text-xs">
              Fri 21
            </span>
          </Bone>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {[
          ["w-full", "Scores refresh on the lobby display."],
          ["w-11/12", "Halftime shows the two-minute recap."],
          ["w-2/3", "Venue feed key is still pending."],
        ].map(([width, line]) => (
          <Bone key={line} className={`h-5 ${width} rounded-sm`}>
            <p className="truncate text-sm leading-5">{line}</p>
          </Bone>
        ))}
      </div>
      <div className="h-px w-full shrink-0 bg-border" />
      <Bone className="h-5 w-20 rounded-sm">
        <h2 className="text-sm font-semibold leading-5">Activity</h2>
      </Bone>
      <div className="flex flex-col gap-4">
        {ACTIVITY.map(([name, text]) => (
          <div key={text} className="flex items-start gap-3">
            <Bone className="size-7 shrink-0 rounded-full">
              <span className="grid size-full place-items-center rounded-full bg-muted text-[11px] font-medium">
                {name!.slice(0, 1)}
              </span>
            </Bone>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Bone className="h-4 w-28 rounded-sm">
                <p className="truncate text-xs font-medium leading-4">{name}</p>
              </Bone>
              <Bone className="h-5 w-4/5 rounded-sm">
                <p className="truncate text-sm leading-5 text-muted-foreground">
                  {text}
                </p>
              </Bone>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
