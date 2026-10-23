import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const status = vi.hoisted(() => ({ pending:false }));
vi.mock("react-dom", () => ({ useFormStatus:() => status }));
import { SubmitButton } from "@/components/SubmitButton";

beforeEach(() => { status.pending = false; });
describe("modern submit controls preserve server-action semantics", () => {
  it("retains the selected operation name and value", () => {
    const html = renderToStaticMarkup(createElement(SubmitButton, { name:"operation", value:"retract", children:"Retract this result" }));
    expect(html).toContain('type="submit"'); expect(html).toContain('name="operation"'); expect(html).toContain('value="retract"'); expect(html).not.toContain('disabled=""');
  });
  it("disables repeat submission and exposes a loading label while pending", () => {
    status.pending = true;
    const html = renderToStaticMarkup(createElement(SubmitButton, { children:"Approve", pendingLabel:"Saving review…" }));
    expect(html).toContain('disabled=""'); expect(html).toContain('aria-busy="true"'); expect(html).toContain("Saving review…"); expect(html).not.toContain(">Approve<");
  });
  it("does not enable a control whose eligibility is disabled", () => {
    const html = renderToStaticMarkup(createElement(SubmitButton, { children:"Publish", disabled:true }));
    expect(html).toContain('disabled=""'); expect(html).toContain('aria-busy="false"');
  });
});
