import type { ReactNode } from "react";

type Props = { active: boolean; icon: ReactNode; children: ReactNode; onClick: () => void };

/** Sidebar navigation button. The active view is announced with aria-current="page". */
export default function NavButton({ active, icon, children, onClick }: Props) {
  return <button
    type="button"
    className={`nav-button ${active ? "active" : ""}`}
    aria-current={active ? "page" : undefined}
    onClick={onClick}
  >{icon}{children}{active && <i aria-hidden="true"/>}</button>;
}
