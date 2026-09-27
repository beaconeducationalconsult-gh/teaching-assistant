import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Modal from "../src/components/Modal";
import NavButton from "../src/components/NavButton";

/**
 * Markup-level accessibility checks. Focus trapping, Escape handling and focus
 * return live in an effect, so they need a real DOM (see the jsdom follow-up);
 * what is asserted here is the contract that screen readers read from markup.
 */
describe("dialog markup", () => {
  const markup = renderToStaticMarkup(<Modal title="A new term, a fresh start." subtitle="SET THE SEASON" onClose={() => {}}>
    <p>form goes here</p>
  </Modal>);

  it("is announced as a modal dialog labelled by its heading", () => {
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    const labelledBy = markup.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(labelledBy).toBeTruthy();
    expect(markup).toContain(`<h2 id="${labelledBy}">A new term, a fresh start.</h2>`);
  });

  it("names its close control instead of relying on an icon", () => {
    expect(markup).toContain('aria-label="Close dialog"');
  });

  it("is reachable by keyboard as a focus fallback and renders its contents", () => {
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain("form goes here");
  });
});

describe("navigation buttons", () => {
  it("announces the current view with aria-current", () => {
    const active = renderToStaticMarkup(<NavButton active icon={null} onClick={() => {}}>My planning</NavButton>);
    expect(active).toContain('aria-current="page"');
    expect(active).toContain('type="button"');

    const inactive = renderToStaticMarkup(<NavButton active={false} icon={null} onClick={() => {}}>Curriculum</NavButton>);
    expect(inactive).not.toContain("aria-current");
  });

  it("hides the active marker from assistive technology", () => {
    const active = renderToStaticMarkup(<NavButton active icon={null} onClick={() => {}}>Account</NavButton>);
    expect(active).toContain("<i aria-hidden=\"true\"></i>");
  });
});
