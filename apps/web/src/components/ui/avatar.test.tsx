import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

// A stub for the detached preloader. Base UI loads the source through
// `new window.Image()` and only renders its <img> once that loads; UI SDK renders
// the <img> straight away. Driving both keeps the load and error paths explicit
// instead of leaving the avatar in its initial loading state.
class StubImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  complete = false;
  naturalWidth = 0;
  crossOrigin: string | null = null;
  referrerPolicy = "";
  sizes = "";
  srcset = "";
  src = "";

  constructor() {
    preloaders.push(this);
  }
}

const preloaders: StubImage[] = [];
const completeDescriptor = Object.getOwnPropertyDescriptor(
  HTMLImageElement.prototype,
  "complete",
);

// jsdom never fetches images, so it reports them as complete with no width. UI SDK
// reads that on mount and would call a rendered <img> a failure at once; force the
// loading state so only a load or error event settles the status.
beforeEach(() => {
  preloaders.length = 0;
  vi.stubGlobal("Image", StubImage);
  Object.defineProperty(HTMLImageElement.prototype, "complete", {
    configurable: true,
    get: () => false,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (completeDescriptor) {
    Object.defineProperty(
      HTMLImageElement.prototype,
      "complete",
      completeDescriptor,
    );
  }
});

// Fires the event on the detached preloader and on the rendered <img>, whichever
// the wrapper on the page listens to.
function settleImage(kind: "load" | "error") {
  act(() => {
    for (const image of preloaders.splice(0)) {
      const handler = kind === "load" ? image.onload : image.onerror;
      handler?.();
    }
    for (const img of document.querySelectorAll("img")) {
      fireEvent[kind](img);
    }
  });
}

function avatarTree(src?: string) {
  return (
    <Avatar className="size-8">
      <AvatarImage src={src} alt="Ada Lovelace" />
      <AvatarFallback>AL</AvatarFallback>
    </Avatar>
  );
}

function renderAvatar(src?: string) {
  return render(avatarTree(src));
}

const fallback = () => screen.queryByText("AL");
const image = () => screen.queryByRole("img", { name: "Ada Lovelace" });

describe("Avatar", () => {
  it("shows the fallback when there is no image", () => {
    render(
      <Avatar>
        <AvatarFallback>AL</AvatarFallback>
      </Avatar>,
    );

    expect(fallback()).toBeVisible();
  });

  it("shows the fallback when the image has no source", () => {
    const { container } = renderAvatar("");

    expect(fallback()).toBeVisible();
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows the fallback while the image loads", () => {
    renderAvatar("/avatars/ada.png");

    expect(fallback()).toBeVisible();
    expect(image()).toBeNull();
  });

  it("shows the image and hides the fallback once it loads", async () => {
    renderAvatar("/avatars/ada.png");
    expect(fallback()).toBeVisible();

    settleImage("load");

    await waitFor(() => expect(image()).toBeVisible());
    expect(fallback()).toBeNull();
  });

  it("shows the fallback when the image fails", () => {
    renderAvatar("/avatars/ada.png");

    settleImage("error");

    expect(fallback()).toBeVisible();
    expect(image()).toBeNull();
  });

  it("restores the fallback when a loaded image is replaced by a failing source", async () => {
    const view = renderAvatar("/avatars/ada.png");
    settleImage("load");
    await waitFor(() => expect(image()).toBeVisible());

    view.rerender(avatarTree("/avatars/gone.png"));
    // Base UI drops back to the fallback as soon as the source changes; UI SDK
    // keeps showing the previous image until the new source settles.
    await act(async () => {});
    settleImage("error");

    await waitFor(() => expect(fallback()).toBeVisible());
    await waitFor(() => expect(image()).toBeNull());
  });

  it("reports the failed image on the root", () => {
    renderAvatar("/avatars/ada.png");
    const root = document.querySelector('[data-slot="avatar"]');

    settleImage("error");

    expect(root).toHaveAttribute("data-loading-status", "error");
  });

  it("keeps the avatar slot on the root and the caller classes", () => {
    renderAvatar("/avatars/ada.png");

    const root = document.querySelector('[data-slot="avatar"]');
    expect(root).not.toBeNull();
    expect(root).toHaveClass("size-8", "rounded-full");
    expect(fallback()).toHaveAttribute("data-slot", "avatar-fallback");
  });
});
