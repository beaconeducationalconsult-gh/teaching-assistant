import type { ReactElement } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_LABELS, THEME_ORDER, type ThemeName } from "../lib/theme";

type Props = { theme: ThemeName; onChange: (theme: ThemeName) => void; className?: string };

const icons: Record<ThemeName, ReactElement> = { warm: <Sun size={13} />, slate: <Moon size={13} /> };

/** Warm Light / Slate Dark switch. The choice is persisted by the caller's theme state. */
export default function ThemeSwitch({ theme, onChange, className }: Props) {
  return <div className={"theme-switch" + (className ? ` ${className}` : "")} role="group" aria-label="Appearance">
    {THEME_ORDER.map((name) => <button
      key={name}
      type="button"
      className={"theme-option" + (theme === name ? " active" : "")}
      aria-pressed={theme === name}
      aria-label={THEME_LABELS[name]}
      title={`${THEME_LABELS[name]} appearance`}
      onClick={() => onChange(name)}
    >{icons[name]}<span>{THEME_LABELS[name]}</span></button>)}
  </div>;
}
