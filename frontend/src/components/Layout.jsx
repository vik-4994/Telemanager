import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Layout({ children }) {
  return (
    <div className="d-flex min-vh-100 bg-body-tertiary">
      <Sidebar />
      <div className="flex-grow-1 d-flex flex-column">
        <Topbar />
        <main className="app-content flex-grow-1">
          <ScrollToTopOnRoute />
          {children}
        </main>
        <BackToTop />
      </div>
      <Style />
    </div>
  );
}

function Topbar() {
  const { pathname } = useLocation();
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("theme") || "light"; } catch { return "light"; }
  });

  useEffect(() => {
    try { document.documentElement.setAttribute("data-bs-theme", theme); localStorage.setItem("theme", theme); } catch {}
  }, [theme]);

  const crumbs = useMemo(() => buildCrumbs(pathname), [pathname]);

  return (
    <header className="app-topbar border-bottom bg-body position-sticky top-0">
      <div className="container-fluid px-3 px-lg-4 py-2">
        <div className="d-flex align-items-center justify-content-between gap-2">
          <nav aria-label="breadcrumb" className="flex-grow-1">
            <ol className="breadcrumb m-0 small">
              {crumbs.map((c, i) => (
                <li key={i} className={`breadcrumb-item ${i === crumbs.length - 1 ? "active" : ""}`} aria-current={i === crumbs.length - 1 ? "page" : undefined}>
                  {c.to && i !== crumbs.length - 1 ? <Link to={c.to}>{c.label}</Link> : c.label}
                </li>
              ))}
            </ol>
          </nav>

          <div className="d-flex align-items-center gap-2">
            <div className="btn-group" role="group" aria-label="Theme">
              {(["light", "dark"]).map((m) => (
                <button key={m} type="button" className={`btn btn-sm ${theme===m? 'btn-primary':'btn-outline-primary'}`} onClick={() => setTheme(m)}>
                  {m === 'light' ? '☀️' : '🌙'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function buildCrumbs(pathname) {
  const parts = String(pathname || "/").split("/").filter(Boolean);
  const items = [{ label: "Главная", to: "/" }];
  let acc = "";
  for (let i = 0; i < parts.length; i++) {
    acc += "/" + parts[i];
    const raw = parts[i];
    const isId = /^\d+$/.test(raw) || raw.length > 24; // id-like
    const label = isId ? `#${raw.slice(0, 8)}` : beautify(raw);
    items.push({ label, to: i < parts.length - 1 ? acc : undefined });
  }
  return items;
}

function beautify(s) {
  return String(s || "").replaceAll("-", " ").replaceAll("_", " ").replace(/\s+/g, " ").trim().replace(/(^|\s)\S/g, (t) => t.toUpperCase());
}

function ScrollToTopOnRoute() {
  const { pathname } = useLocation();
  useEffect(() => { try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {} }, [pathname]);
  return null;
}

function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 240);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!visible) return null;
  return (
    <button
      type="button"
      className="btn btn-primary position-fixed"
      style={{ right: 18, bottom: 18, zIndex: 1030 }}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
    >↑</button>
  );
}

function Style() {
  return (
    <style>{`
      .app-topbar { z-index: 1020; }
      .app-content { padding: 1rem; padding-left: clamp(1rem, 2vw, 1.5rem); padding-right: clamp(1rem, 2vw, 1.5rem); }
      @media (min-width: 992px) { .app-content { padding: 1.5rem 2rem; } }
    `}</style>
  );
}
