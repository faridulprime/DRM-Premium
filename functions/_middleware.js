/**
 * Global DRM page shell.
 * Every HTML response receives the shared navigation/profile component.
 * API and other non-HTML responses pass through unchanged.
 */
export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  if (html.includes("/site-shell.js")) return new Response(html, response);

  const styles = '<link rel="stylesheet" href="/site-shell.css?v=site-shell-04">';
  const script = '<script src="/site-shell.js?v=site-shell-04" defer></script>';
  const withStyles = html.includes("</head>") ? html.replace("</head>", styles + "</head>") : styles + html;
  const withShell = withStyles.includes("</body>") ? withStyles.replace("</body>", script + "</body>") : withStyles + script;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  return new Response(withShell, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
