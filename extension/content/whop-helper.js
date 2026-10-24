/**
 * Lightweight helper on Whop pages.
 * Does NOT scrape private data or auto-submit.
 * Adds a floating ClipCut OS launcher for operators.
 */
(function () {
  if (window.__clipcutOsHelper) return;
  window.__clipcutOsHelper = true;

  const btn = document.createElement("button");
  btn.textContent = "ClipCut OS";
  btn.title = "Open ClipCut OS Manager (use extension popup for full tools)";
  Object.assign(btn.style, {
    position: "fixed",
    zIndex: "2147483647",
    right: "16px",
    bottom: "16px",
    padding: "10px 14px",
    borderRadius: "999px",
    border: "1px solid #155e75",
    background: "#083344",
    color: "#22d3ee",
    fontWeight: "700",
    fontSize: "12px",
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(0,0,0,.35)",
    fontFamily: "system-ui,sans-serif"
  });
  btn.addEventListener("click", () => {
    // Best-effort: open ClipCut in new tab; popup must be user-clicked from toolbar
    window.open("https://www.clipcut.pro", "_blank", "noopener");
  });
  document.documentElement.appendChild(btn);
})();
