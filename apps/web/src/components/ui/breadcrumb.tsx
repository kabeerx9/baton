"use client";

import {
  mergeProps,
  renderElement,
  type PartProps,
} from "@ui-sdk/react/primitive";
import { ChevronRight } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/cn";
import { i18n } from "@/lib/i18n";

function Breadcrumb({ ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      aria-label={i18n.t("common:breadcrumb.label")}
      data-slot="breadcrumb"
      {...props}
    />
  );
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      className={cn(
        "wrap-break-word flex flex-wrap items-center gap-1.5 text-muted-foreground text-sm sm:gap-2.5",
        className,
      )}
      data-slot="breadcrumb-list"
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      className={cn("inline-flex items-center gap-1.5", className)}
      data-slot="breadcrumb-item"
      {...props}
    />
  );
}

interface BreadcrumbLinkProps extends Omit<PartProps<"a">, "className"> {
  className?: string;
}

function BreadcrumbLink({ className, render, ...props }: BreadcrumbLinkProps) {
  const defaultProps = {
    className: cn("transition-colors hover:text-foreground", className),
    "data-slot": "breadcrumb-link",
  };

  return renderElement("a", mergeProps(defaultProps, props), render);
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- Current breadcrumb is intentionally not a navigable link.
    <span
      aria-current="page"
      aria-disabled="true"
      className={cn("font-normal text-foreground", className)}
      data-slot="breadcrumb-page"
      role="link"
      {...props}
    />
  );
}

function BreadcrumbSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      aria-hidden="true"
      className={cn("opacity-80 [&>svg]:size-4", className)}
      data-slot="breadcrumb-separator"
      role="presentation"
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  );
}

export {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
