"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import type { KeyboardEvent } from "react";

import { cn } from "@/lib/utils";
import type { MenuItem } from "@/lib/menu-data";

type SidebarItemProps = {
  item: MenuItem;
  pathname: string;
  depth?: number;
  isCollapsed: boolean;
  isOpen: boolean;
  onToggle: (id: string) => void;
  onLeafClick?: () => void;
  parentOpen?: boolean;
};

const isActivePath = (pathname: string, href?: string) =>
  !!href && pathname === href;

export function SidebarItem({
  item,
  pathname,
  depth = 0,
  isCollapsed,
  isOpen,
  onToggle,
  onLeafClick,
  parentOpen = true,
}: SidebarItemProps) {
  const hasChildren = !!item.children?.length;
  const levelPadding = depth === 0 ? "px-3" : "pl-4 pr-3";
  const controlsId = `${item.id}-submenu`;

  const onActionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement | HTMLAnchorElement>,
  ) => {
    if (event.key === " ") {
      event.preventDefault();
      (event.currentTarget as HTMLElement).click();
    }
  };

  if (hasChildren) {
    return (
      <li role="none">
        <button
          aria-controls={controlsId}
          aria-expanded={isOpen}
          className={cn(
            "group flex w-full items-center gap-2 rounded-lg py-2 text-sm text-foreground transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            levelPadding,
            depth === 0 && "font-medium",
            isOpen && "bg-muted/60",
            isCollapsed && depth === 0 && "justify-center px-2",
          )}
          data-focusable="true"
          data-has-children="true"
          data-item-id={item.id}
          onClick={() => onToggle(item.id)}
          onKeyDown={onActionKeyDown}
          role="menuitem"
          suppressHydrationWarning
          tabIndex={parentOpen ? undefined : -1}
          type="button"
        >
          {item.icon ? <item.icon className="h-4 w-4 shrink-0" /> : null}
          {!isCollapsed || depth > 0 ? (
            <>
              <span className="flex-1 text-left">{item.label}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </>
          ) : null}
        </button>

        <ul
          className={cn(
            "overflow-hidden transition-all duration-200 border-l border-border/40 ml-[23px] pl-2 space-y-1 my-1",
            isOpen && !isCollapsed ? "max-h-[480px] opacity-100" : "max-h-0 opacity-0",
          )}
          id={controlsId}
          role="menu"
        >
          {item.children?.map((child) => (
            <SidebarItem
              depth={depth + 1}
              isCollapsed={isCollapsed}
              isOpen={false}
              item={child}
              key={child.id}
              onLeafClick={onLeafClick}
              onToggle={onToggle}
              pathname={pathname}
              parentOpen={isOpen && !isCollapsed}
            />
          ))}
        </ul>
      </li>
    );
  }

  const active = isActivePath(pathname, item.href);
  return (
    <li role="none">
      <Link
        className={cn(
          "flex items-center gap-2 rounded-lg py-2 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          levelPadding,
          depth === 0 && "font-medium",
          depth > 0 && "border-l-2 border-l-transparent rounded-l-none",
          active
            ? depth === 0
              ? "bg-primary/10 font-medium text-primary border border-primary/20"
              : "bg-primary/10 font-semibold text-primary border-l-primary"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground focus-visible:border-l-primary focus-visible:rounded-l-none focus-visible:text-primary",
          isCollapsed && depth === 0 && "justify-center px-2",
        )}
        data-focusable="true"
        data-has-children="false"
        data-item-id={item.id}
        href={item.href ?? "#"}
        prefetch
        onClick={onLeafClick}
        onKeyDown={onActionKeyDown}
        role="menuitem"
        suppressHydrationWarning
        tabIndex={parentOpen ? undefined : -1}
      >
        {item.icon && depth === 0 ? <item.icon className="h-4 w-4 shrink-0" /> : null}
        {(!isCollapsed || depth > 0) && <span className={depth === 0 ? "flex-1 text-left truncate" : "truncate"}>{item.label}</span>}
      </Link>
    </li>
  );
}
