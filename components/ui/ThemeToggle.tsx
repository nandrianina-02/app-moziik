"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label="Changer de thème"
      className="grid h-9 w-9 place-items-center rounded-full border border-border transition-colors hover:border-accent"
    >
      {theme === "dark" ? (
        <Sun size={16} className="text-ink" />
      ) : (
        <Moon size={16} className="text-ink" />
      )}
    </button>
  );
}
