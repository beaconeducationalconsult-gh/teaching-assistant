import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ThemeSwitch from "../src/components/ThemeSwitch";
import LessonSetupForm from "../src/components/LessonSetupForm";
import type { TermRow } from "../src/lib/planning";

const terms: TermRow[] = [{ id: "term-one", name: "First Term", academicYear: "2026/2027", startDate: "2026-09-01", endDate: "2026-12-04", archivedAt: null }];

describe("appearance switch markup", () => {
  it("offers both appearances and marks exactly the active one", () => {
    const warm = renderToStaticMarkup(<ThemeSwitch theme="warm" onChange={() => {}} />);
    expect(warm).toContain("Warm Light");
    expect(warm).toContain("Slate Dark");
    expect((warm.match(/aria-pressed="true"/g) || [])).toHaveLength(1);
    expect(warm).toContain('class="theme-option active" aria-pressed="true" aria-label="Warm Light"');
    expect(warm).toContain('aria-label="Slate Dark"');

    const slate = renderToStaticMarkup(<ThemeSwitch theme="slate" onChange={() => {}} />);
    expect(slate).toContain('class="theme-option active" aria-pressed="true" aria-label="Slate Dark"');
  });
});

describe("dropdown lesson setup markup", () => {
  it("renders term and week dropdowns, a title, and a summary field", () => {
    const markup = renderToStaticMarkup(<LessonSetupForm
      workspaceId="workspace-one"
      terms={terms}
      defaultTermId="term-one"
      defaultWeekId="week-one"
      busy={false}
      onCancel={() => {}}
      onSave={() => {}}
    />);
    expect(markup).toContain("First Term · 2026/2027");
    expect((markup.match(/<select/g) || [])).toHaveLength(2);
    expect(markup).toContain("Lesson title");
    expect(markup).toContain("Short summary");
    expect(markup).toContain("Save as draft");
  });
});
