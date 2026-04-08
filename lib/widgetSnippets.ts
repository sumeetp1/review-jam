// ─── Widget Snippet Generators ───────────────────────────────────────────────
// Extracted for reuse across Widget Studio, Integrations, and standalone widgets page.

export function iframeSnippet(productId: string, theme: string, baseUrl: string): string {
  return `<iframe
  src="${baseUrl}/api/widget/${productId}?theme=${theme}"
  width="360"
  height="420"
  frameborder="0"
  scrolling="no"
  style="border:none;border-radius:14px;overflow:hidden;"
  title="Review Jam Trust Widget"
  loading="lazy"
></iframe>`;
}

export function reactSnippet(productId: string, theme: string, baseUrl: string): string {
  return `// ReviewJamWidget.tsx
export function ReviewJamWidget() {
  return (
    <iframe
      src="${baseUrl}/api/widget/${productId}?theme=${theme}"
      width={360}
      height={420}
      style={{ border: "none", borderRadius: 14, overflow: "hidden" }}
      title="Review Jam Trust Widget"
      loading="lazy"
    />
  );
}`;
}

export function htmlSnippet(productId: string, theme: string, baseUrl: string): string {
  return `<!-- Review Jam Trust Widget -->
<div style="width:360px;">
  <iframe
    src="${baseUrl}/api/widget/${productId}?theme=${theme}"
    width="360"
    height="420"
    frameborder="0"
    scrolling="no"
    style="border:none;border-radius:14px;"
    title="Review Jam Trust Widget"
    loading="lazy"
  ></iframe>
</div>`;
}

export function shopifySnippet(productId: string, baseUrl: string): string {
  return `{% comment %} Review Jam Trust Widget {% endcomment %}
<div class="reviewjam-widget" style="margin:2rem 0;">
  <iframe
    src="${baseUrl}/api/widget/${productId}?theme=auto"
    width="360"
    height="420"
    frameborder="0"
    scrolling="no"
    style="border:none;border-radius:14px;overflow:hidden;"
    title="Review Jam Trust Widget"
    loading="lazy"
  ></iframe>
</div>`;
}
