import {
  createFocusRecovery,
  createRovingFocus,
  definePrimitive,
  elements,
  keepFocus,
  prepareAnnouncements,
  selects,
  spatialMove,
} from "@ui-sdk/core";
import { type CardSpot, focusFallback } from "./focus-fallback";

/** What a frame knows about its card: where it sits and what to call it. */
export type FrameProps = {
  value: string;
  column: string;
  /** Position in its column, from 0. */
  index: number;
  /** What a person calls the card, like "T-5". For announcements. */
  label: string;
};

export type FrameState = {
  /** This card holds the board's one tab stop. */
  active: boolean;
};

export type FocusRecovered = {
  /** The card that held focus. */
  key: string;
  label: string;
  /** The card that has focus now, or null when none is left. */
  to: string | null;
  /** The column of that card. */
  column: string | null;
  /** "moved": the same card, now in another column. "removed": a neighbor. */
  reason: "moved" | "removed";
};

export type BoardNavOptions = {
  /** Every column, left to right. Needed to pick a neighbor column. */
  columns?: string[];
  onFocusRecovered?: (details: FocusRecovered) => void;
};

type Direction = "up" | "down";

const POPUP =
  "[role='dialog'], [role='alertdialog'], [role='menu'], [role='listbox']";
const ARROW: Record<Direction, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
};

/**
 * Keyboard navigation for the board. Each card's link is the one roving item:
 * the arrows go to the nearest card on screen, so the 1, 2 and 4 column
 * layouts all work. A frame around the link and its inner controls restores
 * focus when realtime updates move or remove the card.
 */
const boardNav = definePrimitive({
  name: "board-nav",
  options: { columns: "list", onFocusRecovered: "callback" },
  state: (_options: BoardNavOptions) => ({ focused: null as string | null }),
  api: (context) => {
    // The element inside a card that has focus now, and the column its card
    // was in. React moves or replaces a card's element and focus falls to the
    // page; this tells `keepCurrent` what to give focus back to.
    let held: { key: string; el: HTMLElement; column: string } | null = null;

    const move = spatialMove();
    const roving = createRovingFocus(context, {
      slot: "card",
      key: "focused",
      move,
    });

    const report = (details: FocusRecovered) =>
      context.options().onFocusRecovered?.(details);

    const recovery = createFocusRecovery<FrameProps>({
      // Runs when a card's element leaves the page while it holds focus.
      fallback: (lost) => {
        // The whole board left the page (navigation): nothing to recover.
        if (elements(context, "root").length === 0) return undefined;
        const frames = elements<FrameProps>(context, "frame");
        const columnOf = (key: string) =>
          frames.find((frame) => frame.key === key)?.props.column ?? null;
        // The card changed column and React replaced its element. In a
        // browser the old part leaves before the new one binds, so this runs.
        const moved = context.element("card", lost.key);
        if (moved?.isConnected) {
          report({
            key: lost.key,
            label: lost.props.label,
            to: lost.key,
            column: columnOf(lost.key),
            reason: "moved",
          });
          return moved;
        }

        const spots: CardSpot[] = frames.map((frame) => ({
          key: frame.key,
          column: frame.props.column,
          index: frame.props.index,
        }));
        const to = focusFallback(
          lost.props,
          spots,
          context.options().columns ?? [],
        );
        report({
          key: lost.key,
          label: lost.props.label,
          to,
          column: to ? columnOf(to) : null,
          reason: "removed",
        });
        return to ? context.element("card", to) : undefined;
      },
    });

    /** The card link that holds or contains `target`, if any. */
    const cardAt = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return undefined;
      const frame = target.closest("[data-slot='board-nav-frame']");
      return roving.items().find((item) => frame?.contains(item.el));
    };

    return {
      roving,
      recovery,
      /** Arrow, Home and End on a card link. */
      keydown(event: KeyboardEvent, el: HTMLElement) {
        roving.keydown(event, el);
      },
      /**
       * Move one card up or down from the card that holds `target`.
       * "outside": `target` is not on a card. "stayed": no card lies that way.
       */
      step(
        direction: Direction,
        target: EventTarget | null,
      ): "moved" | "stayed" | "outside" {
        const from = cardAt(target);
        if (!from) return "outside";
        const key = move(
          new KeyboardEvent("keydown", { key: ARROW[direction] }),
          { from, items: roving.items(), rtl: false },
        );
        if (!key || key === from.key) return "stayed";
        roving.focus(key);
        return "moved";
      },
      /** Put focus on the card that holds the tab stop. */
      focusCurrent: () => roving.focus(),
      /** Escape on a card's inner control: back to the card link. */
      escapeToCard(event: KeyboardEvent) {
        if (event.defaultPrevented || event.key !== "Escape") return;
        const target = event.target;
        if (!(target instanceof Element) || target.closest(POPUP)) return;
        const card = cardAt(target);
        if (!card || card.el === target) return;
        event.preventDefault();
        card.el.focus();
      },
      track(el: HTMLElement | null, key: string) {
        const column = el && context.props<FrameProps>("frame", key)?.column;
        held = el && column ? { key, el, column } : null;
      },
      /**
       * After cards were moved or reordered: give focus back to the card that
       * had it. A card that changed column is reported as "moved".
       */
      keepCurrent() {
        const current = held;
        if (!current) return;
        const frame = context.props<FrameProps>("frame", current.key);
        // The card is gone: `recovery` picks a neighbor.
        if (!frame) return;
        const replaced = !current.el.isConnected;
        if (replaced && frame.column !== current.column) {
          held = { ...current, column: frame.column };
          report({
            key: current.key,
            label: frame.label,
            to: current.key,
            column: frame.column,
            reason: "moved",
          });
        }
        keepFocus(() =>
          current.el.isConnected
            ? current.el
            : context.element("card", current.key),
        );
      },
    };
  },
  slots: (slot) => ({
    root: slot({
      role: "group",
      bind: (el) => {
        prepareAnnouncements(el.ownerDocument);
      },
    }),
    frame: slot<FrameProps, FrameState>({
      props: {
        value: "string",
        column: "string",
        index: "number",
        label: "string",
      },
      selects: selects({ focused: ({ key }) => [key, null] }),
      state: (state, part) => ({
        active:
          part.api.roving.tabIndex(state, {
            key: part.key,
            props: part.props,
          }) === "0",
      }),
      on: {
        keydown: (event, { api }) => api.escapeToCard(event as KeyboardEvent),
        focusin: (event, { api, key }) =>
          api.track(event.target as HTMLElement, key),
        focusout: (event, { api }) => {
          // A card that React moves blurs while it is out of the page. Only a
          // real blur, on an element that is still there, ends the hold.
          if ((event.target as HTMLElement).isConnected) api.track(null, "");
        },
      },
      bind: (el, part) => part.api.recovery.bind(el, part),
    }),
    card: slot<{ value: string }>({
      props: { value: "string" },
      selects: selects({ focused: ({ key }) => [key, null] }),
      attrs: (state, part) => ({
        tabindex: part.api.roving.tabIndex(state, part),
      }),
      on: {
        keydown: (event, { el, api }) => {
          if (el) api.keydown(event as KeyboardEvent, el);
        },
      },
      bind: (el, part) => part.api.roving.bind(el, part),
    }),
  }),
});

export { boardNav };
