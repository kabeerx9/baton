"use client";

import {
  Avatar as AvatarPrimitive,
  AvatarFallback as AvatarFallbackPrimitive,
  AvatarImage as AvatarImagePrimitive,
} from "@ui-sdk/react/avatar";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";
import { resolveAvatarSrc } from "@/lib/resolve-avatar-src";

function Avatar({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive>) {
  return (
    <AvatarPrimitive
      className={cn(
        "inline-flex size-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-background align-middle font-medium text-xs",
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  src,
  ...props
}: ComponentProps<typeof AvatarImagePrimitive>) {
  return (
    <AvatarImagePrimitive
      className={cn("size-full object-cover", className)}
      src={typeof src === "string" ? resolveAvatarSrc(src) : src}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: ComponentProps<typeof AvatarFallbackPrimitive>) {
  return (
    <AvatarFallbackPrimitive
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted",
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback, AvatarImage };
