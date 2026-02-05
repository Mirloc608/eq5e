/**
 * Shared Accent Card helper for EQ5e AA UI (core)
 * Provides small HTML snippets/classes used by reward log and AA cards.
 */
export function accentHeaderHtml({ title = "", subtitle = "", icon = "fa-solid fa-star" } = {}) {
  const t = String(title ?? "");
  const s = String(subtitle ?? "");
  return `<div class="eq5e-accent-header"><i class="${icon}"></i><div class="eq5e-accent-header__text"><div class="eq5e-accent-header__title">${t}</div>${s ? `<div class="eq5e-accent-header__subtitle">${s}</div>` : ""}</div></div>`;
}

export function injectEq5eAccentCardStyles() {
  try {
    const id = "eq5e-accent-card-styles";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .eq5e-accent-header { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:10px;
        background: linear-gradient(90deg, rgba(120,80,255,0.18), rgba(120,80,255,0.04));
        border: 1px solid rgba(120,80,255,0.25); position: relative; overflow:hidden; }
      .eq5e-accent-header i { opacity:0.9; }
      .eq5e-accent-header__title { font-weight:700; }
      .eq5e-accent-header__subtitle { opacity:0.8; font-size: 12px; }
      .eq5e-accent-header:before { content:""; position:absolute; left:-40px; top:-40px; width:160px; height:160px;
        background: radial-gradient(circle, rgba(120,80,255,0.22), transparent 60%); transform: rotate(12deg); }
    `;
    document.head.appendChild(style);
  } catch (e) {}
}
