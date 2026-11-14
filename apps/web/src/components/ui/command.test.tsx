import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Fragment, type ReactElement, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
} from "./command";

afterEach(cleanup);

type Entry = { id: string; label: string };
type Group = { value: string; label: string; items: Entry[] };

const GROUPS: Group[] = [
  {
    value: "fruit",
    label: "Fruit",
    items: [
      { id: "apple", label: "Apple" },
      { id: "apricot", label: "Apricot" },
      { id: "banana", label: "Banana" },
    ],
  },
  {
    value: "veg",
    label: "Vegetables",
    items: [{ id: "carrot", label: "Carrot" }],
  },
];

/**
 * One place that knows how callers wire the list. Only this component changes
 * between the Base UI and the UI SDK wrapper (record section 12): the props
 * that carry the data, the query and the run callback.
 */
function List({
  groups = GROUPS,
  onRun,
  noFilter = false,
  initialQuery = "",
  onQuery,
}: {
  groups?: Group[];
  onRun?: (id: string) => void;
  noFilter?: boolean;
  initialQuery?: string;
  onQuery?: (query: string) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  return (
    <Command
      filter={noFilter ? null : undefined}
      query={query}
      onQueryChange={(next) => {
        setQuery(next);
        onQuery?.(next);
      }}
    >
      <CommandInput aria-label="Search" placeholder="Search" />
      <CommandPanel>
        <CommandEmpty>Nothing found</CommandEmpty>
        <CommandList>
          {groups.map((group, groupIndex) => (
            <Fragment key={group.value}>
              <CommandGroup>
                <CommandGroupLabel>{group.label}</CommandGroupLabel>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.label}
                    onSelect={() => onRun?.(item.id)}
                  >
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              {groupIndex < groups.length - 1 && <CommandSeparator />}
            </Fragment>
          ))}
        </CommandList>
      </CommandPanel>
    </Command>
  );
}

// UI SDK settles the highlight and the empty state in a microtask.
const flush = () =>
  act(async () => {
    await Promise.resolve();
  });
async function show(ui: ReactElement) {
  render(ui);
  await flush();
}
async function change(value: string) {
  fireEvent.change(input(), { target: { value } });
  await flush();
}
async function press(key: string) {
  fireEvent.keyDown(input(), { key });
  await flush();
}

// UI SDK hides an emptied group with `hidden`; Base UI left it out of the page.
const shown = (text: string) => {
  const element = screen.queryByText(text);
  return element !== null && element.closest("[hidden]") === null;
};
const separators = () =>
  document.querySelectorAll("[data-slot=command-separator]");
const input = () => screen.getByRole("combobox", { name: "Search" });
const names = () => screen.queryAllByRole("option").map((o) => o.textContent);
const highlighted = () =>
  screen
    .queryAllByRole("option")
    .filter((o) => o.hasAttribute("data-highlighted"))
    .map((o) => o.textContent);

describe("Command list", () => {
  it("shows every item and highlights the first with an empty field", async () => {
    await show(<List />);

    expect(names()).toEqual(["Apple", "Apricot", "Banana", "Carrot"]);
    expect(highlighted()).toEqual(["Apple"]);
    expect(screen.getByText("Fruit")).toBeInTheDocument();
    expect(screen.getByText("Vegetables")).toBeInTheDocument();
  });

  it("filters by contains as the text changes and highlights the first match", async () => {
    await show(<List />);

    // "ap" is inside Apple and Apricot. A fuzzy filter would also keep Banana
    // (a-p-... no) but "ana" must not match Apple by letters in order.
    await change("ap");
    expect(names()).toEqual(["Apple", "Apricot"]);
    expect(highlighted()).toEqual(["Apple"]);

    await change("nan");
    expect(names()).toEqual(["Banana"]);
    expect(highlighted()).toEqual(["Banana"]);

    await change("");
    expect(names()).toHaveLength(4);
    expect(highlighted()).toEqual(["Apple"]);
  });

  it("does not match letters that are only in order (contains, not fuzzy)", async () => {
    await show(<List />);

    // a, p, t... "aae" are in order inside Apple but are not a substring.
    await change("ale");

    expect(names()).toEqual([]);
  });

  it("moves the highlight with ArrowDown and ArrowUp", async () => {
    await show(<List />);

    await press("ArrowDown");
    expect(highlighted()).toEqual(["Apricot"]);
    await press("ArrowDown");
    expect(highlighted()).toEqual(["Banana"]);
    await press("ArrowUp");
    expect(highlighted()).toEqual(["Apricot"]);
  });

  it("runs the highlighted item on Enter, once", async () => {
    const onRun = vi.fn();
    await show(<List onRun={onRun} />);

    await press("ArrowDown");
    await press("Enter");

    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun).toHaveBeenCalledWith("apricot");
  });

  it("runs the first match on Enter after typing", async () => {
    const onRun = vi.fn();
    await show(<List onRun={onRun} />);

    await change("carr");
    await press("Enter");

    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun).toHaveBeenCalledWith("carrot");
  });

  it("runs an item on click, once", async () => {
    const onRun = vi.fn();
    await show(<List onRun={onRun} />);

    fireEvent.click(screen.getByRole("option", { name: "Banana" }));
    await flush();

    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun).toHaveBeenCalledWith("banana");
  });

  it("shows the empty part only when nothing matches", async () => {
    await show(<List />);
    expect(screen.queryByText("Nothing found")).not.toBeInTheDocument();

    await change("zzz");

    expect(screen.getByText("Nothing found")).toBeInTheDocument();
    expect(names()).toEqual([]);
  });

  it("hides a group and its label when the filter leaves it empty", async () => {
    await show(<List />);

    await change("carr");

    expect(names()).toEqual(["Carrot"]);
    expect(shown("Vegetables")).toBe(true);
    expect(shown("Fruit")).toBe(false);
  });

  it("shows a separator between groups that both have matches", async () => {
    await show(<List />);

    expect(separators()).toHaveLength(1);
  });

  it("keeps every item with no filter, as a server-filtered list needs", async () => {
    await show(<List noFilter />);

    await change("zzz");

    expect(names()).toEqual(["Apple", "Apricot", "Banana", "Carrot"]);
    expect(screen.queryByText("Nothing found")).not.toBeInTheDocument();
  });

  it("shows a controlled query in the field and reports typing", async () => {
    const onQuery = vi.fn();
    await show(<List initialQuery="an" onQuery={onQuery} />);

    expect(input()).toHaveValue("an");

    await change("ca");
    expect(input()).toHaveValue("ca");
    expect(onQuery).toHaveBeenLastCalledWith("ca");
    expect(names()).toEqual(["Carrot"]);
  });

  it("moves the highlight back to the first row when the rows change", async () => {
    await show(<List />);
    await press("ArrowDown");
    await press("ArrowDown");
    expect(highlighted()).toEqual(["Banana"]);

    // Banana drops out, so the highlight cannot stay on it.
    await change("r");

    expect(names()).toEqual(["Apricot", "Carrot"]);
    expect(highlighted()).toEqual(["Apricot"]);
  });

  it("never submits a surrounding form on Enter (trap 1)", async () => {
    const clicked = vi.fn();
    const submitted = vi.fn((event: { preventDefault: () => void }) =>
      event.preventDefault(),
    );
    await show(
      <form onSubmit={submitted}>
        <List />
        <button type="submit" onClick={clicked}>
          Save
        </button>
      </form>,
    );

    const allowed = fireEvent.keyDown(input(), { key: "Enter" });

    expect(allowed).toBe(false);
    expect(clicked).not.toHaveBeenCalled();
    expect(submitted).not.toHaveBeenCalled();
  });

  it("negative control: a plain Enter handler that clicks submit is seen", async () => {
    const clicked = vi.fn();
    render(
      <form>
        <input
          aria-label="plain"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.form
                ?.querySelector<HTMLButtonElement>("button[type=submit]")
                ?.click();
            }
          }}
        />
        <button type="submit" onClick={clicked}>
          Save
        </button>
      </form>,
    );

    fireEvent.keyDown(screen.getByLabelText("plain"), { key: "Enter" });

    expect(clicked).toHaveBeenCalledTimes(1);
  });
});
