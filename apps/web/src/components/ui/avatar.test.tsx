import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

function renderAvatar(src?: string) {
  render(
    <Avatar className="size-8">
      <AvatarImage src={src} alt="Ada Lovelace" />
      <AvatarFallback>AL</AvatarFallback>
    </Avatar>,
  );
}

describe("Avatar", () => {
  it("shows the fallback when there is no image", () => {
    render(
      <Avatar>
        <AvatarFallback>AL</AvatarFallback>
      </Avatar>,
    );

    expect(screen.getByText("AL")).toBeVisible();
  });

  it("shows the fallback when the image has no source", () => {
    renderAvatar("");

    expect(screen.getByText("AL")).toBeVisible();
  });

  it("shows the fallback when the image fails to load", () => {
    renderAvatar("/avatars/ada.png");

    for (const image of document.querySelectorAll("img")) {
      fireEvent.error(image);
    }

    expect(screen.getByText("AL")).toBeVisible();
  });

  it("keeps the avatar slot on the root and the caller classes", () => {
    renderAvatar("/avatars/ada.png");

    const root = document.querySelector('[data-slot="avatar"]');
    expect(root).not.toBeNull();
    expect(root).toHaveClass("size-8", "rounded-full");
    expect(screen.getByText("AL")).toHaveAttribute(
      "data-slot",
      "avatar-fallback",
    );
  });
});
