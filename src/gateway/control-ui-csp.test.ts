import { afterEach, describe, expect, it } from "vitest";
import { buildControlUiCspHeader } from "./control-ui-csp.js";

describe("buildControlUiCspHeader", () => {
  const originalEnv = process.env.OPENCLAW_FRAME_ANCESTORS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.OPENCLAW_FRAME_ANCESTORS;
    } else {
      process.env.OPENCLAW_FRAME_ANCESTORS = originalEnv;
    }
  });

  it("blocks inline scripts while allowing inline styles", () => {
    delete process.env.OPENCLAW_FRAME_ANCESTORS;
    const csp = buildControlUiCspHeader();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
  });

  it("allows Google Fonts for style and font loading", () => {
    const csp = buildControlUiCspHeader();
    expect(csp).toContain("https://fonts.googleapis.com");
    expect(csp).toContain("font-src 'self' https://fonts.gstatic.com");
  });

  it("respects OPENCLAW_FRAME_ANCESTORS env var", () => {
    process.env.OPENCLAW_FRAME_ANCESTORS = "https://www.yourclaw.ai https://yourclaw.ai";
    const csp = buildControlUiCspHeader();
    expect(csp).toContain("frame-ancestors https://www.yourclaw.ai https://yourclaw.ai");
    expect(csp).not.toContain("frame-ancestors 'none'");
  });

  it("defaults to frame-ancestors 'none' when env var is empty", () => {
    process.env.OPENCLAW_FRAME_ANCESTORS = "";
    const csp = buildControlUiCspHeader();
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
