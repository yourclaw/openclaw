export function buildControlUiCspHeader(): string {
  // Control UI: block framing by default, block inline scripts, keep styles
  // permissive (UI uses a lot of inline style attributes in templates).
  // Keep Google Fonts origins explicit in CSP for deployments that load
  // external Google Fonts stylesheets/font files.
  //
  // OPENCLAW_FRAME_ANCESTORS: space-separated list of origins allowed to
  // embed this page in an iframe (e.g. "https://www.yourclaw.ai").
  // Defaults to 'none' (no embedding) when unset.
  const frameAncestors =
    process.env.OPENCLAW_FRAME_ANCESTORS?.trim() || "'none'";
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    `frame-ancestors ${frameAncestors}`,
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' ws: wss:",
  ].join("; ");
}
