import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ConfirmDialog } from "./confirm-dialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

/**
 * Enter the way a browser runs it: an input in a form submits that form when
 * the keydown was not cancelled. jsdom does not, so a test that skips this
 * could never see the submission the guard is about.
 */
function enter(element: HTMLElement) {
  const proceed = fireEvent.keyDown(element, { key: "Enter" });
  if (!proceed) return false;
  if (element instanceof HTMLInputElement && element.form !== null) {
    element.form.requestSubmit();
  }
  return true;
}

function Form({ children }: { children?: React.ReactNode }) {
  const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
  const view = render(
    <form onSubmit={onSubmit}>
      <input aria-label="Channel name" />
      <button type="submit">Save channel</button>
      {children}
    </form>,
  );
  return { onSubmit, view };
}

describe("ConfirmDialog inside a form", () => {
  it("keeps Enter in a dialog input from submitting the form around it", () => {
    const { onSubmit } = Form({
      children: (
        <ConfirmDialog
          container={document.body}
          open
          onOpenChange={() => {}}
          title="Disconnect?"
          confirmLabel="Disconnect"
          onConfirm={() => {}}
        >
          <input aria-label="Reason" />
        </ConfirmDialog>
      ),
    });

    const dialog = screen.getByRole("alertdialog");
    // UI SDK renders the content in place, so the usage portals it out of the
    // form around it.
    expect(dialog.closest("form")).toBeNull();

    expect(enter(screen.getByLabelText("Reason"))).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(dialog.isConnected).toBe(true);
  });

  it("starts on the cancel answer when the usage portals it out of the form", async () => {
    Form({
      children: (
        <ConfirmDialog
          container={document.body}
          open
          onOpenChange={() => {}}
          title="Disconnect?"
          confirmLabel="Disconnect"
          onConfirm={() => {}}
        />
      ),
    });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "common:actions.cancel" }),
      ).toHaveFocus(),
    );
  });

  it("negative control: an input in the form around the dialog does submit", () => {
    const { onSubmit } = Form({});
    enter(screen.getByLabelText("Channel name"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
