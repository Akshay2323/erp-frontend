"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import type { MenuItem } from "@/lib/menu-data";

type MenuSearchProps = {
  value: string;
  onChange: (value: string) => void;
  menuItems: MenuItem[];
};

export function MenuSearch({ value, onChange, menuItems }: MenuSearchProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Flatten the menu tree into searchable leaf items
  const searchableItems = useMemo(() => {
    const list: Array<{
      label: string;
      href: string;
      parentLabel?: string;
      icon?: any;
    }> = [];

    menuItems.forEach((group) => {
      if (group.href) {
        list.push({
          label: group.label,
          href: group.href,
          icon: group.icon,
        });
      } else if (group.children) {
        group.children.forEach((child) => {
          if (child.href) {
            list.push({
              label: child.label,
              href: child.href,
              parentLabel: group.label,
              icon: group.icon,
            });
          }
        });
      }
    });

    return list;
  }, [menuItems]);

  // Filter matching items
  const matches = useMemo(() => {
    if (!value.trim()) return [];
    const normalized = value.toLowerCase().trim();
    return searchableItems.filter(
      (item) =>
        item.label.toLowerCase().includes(normalized) ||
        (item.parentLabel && item.parentLabel.toLowerCase().includes(normalized))
    );
  }, [searchableItems, value]);

  // Show suggestion box only when input is focused and has matching entries
  useEffect(() => {
    setIsOpen(matches.length > 0);
    setActiveIndex(-1);
  }, [matches]);

  // Handle outside clicks to close the dropdown
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const selectItem = (href: string) => {
    onChange(""); // Clear search query to close suggestion box and clear input
    setIsOpen(false);
    router.push(href);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || matches.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + matches.length) % matches.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const targetIndex = activeIndex >= 0 ? activeIndex : 0;
      if (matches[targetIndex]) {
        selectItem(matches[targetIndex].href);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full max-w-md" ref={containerRef}>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label="Search menu"
          className="pl-9 pr-4 h-10 w-full"
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => {
            if (matches.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search pages or menus..."
          value={value}
        />
      </div>

      {isOpen && matches.length > 0 && (
        <div className="absolute left-0 right-0 mt-2 z-50 rounded-xl border border-border bg-card p-1.5 shadow-2xl max-h-[320px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Suggestions
          </div>
          <div className="space-y-0.5">
            {matches.map((item, idx) => {
              const Icon = item.icon;
              const isActive = idx === activeIndex;
              return (
                <button
                  key={`${item.href}-${idx}`}
                  onClick={() => selectItem(item.href)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted/80"
                  }`}
                  type="button"
                >
                  {Icon && (
                    <div className={`p-1.5 rounded-md ${isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.label}</p>
                    {item.parentLabel && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {item.parentLabel}
                      </p>
                    )}
                  </div>
                  <ChevronRight className={`h-3 w-3 ${isActive ? "text-primary" : "text-muted-foreground/50"}`} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
