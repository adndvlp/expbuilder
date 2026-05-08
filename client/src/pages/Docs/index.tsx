import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { DOC_SECTIONS } from "./content";
import "./index.css";

let mermaidModule: any = null;

async function getMermaid() {
  if (!mermaidModule) {
    const m = await import("mermaid");
    m.default.initialize({
      startOnLoad: false,
      theme: "base",
      themeVariables: {
        mainBkg: "#3d92b4",
        nodeBorder: "#3e7d96",
        nodeTextColor: "#ffffff",
        textColor: "#333333",
        lineColor: "#3d92b4",
        clusterBkg: "#edf6fa",
        clusterBorder: "#3e7d96",
        primaryColor: "#3d92b4",
        primaryBorderColor: "#3e7d96",
        primaryTextColor: "#ffffff",
        secondaryColor: "#d6ebf3",
        secondaryBorderColor: "#3d92b4",
        secondaryTextColor: "#333333",
        fontSize: "14px",
        fontFamily: "Inter, system-ui, sans-serif",
        actorBkg: "#e8f4f9",
        actorBorder: "#3d92b4",
        actorTextColor: "#333333",
        actorLineColor: "#3e7d96",
        signalColor: "#333333",
        signalTextColor: "#333333",
        labelBoxBkgColor: "#edf6fa",
        labelBoxBorderColor: "#3e7d96",
        labelTextColor: "#333333",
        loopTextColor: "#333333",
        noteBkgColor: "#fff8e1",
        noteBorderColor: "#d4af37",
        noteTextColor: "#333333",
        activationBkgColor: "#e8f4f9",
        activationBorderColor: "#3d92b4",
        sequenceNumberColor: "#ffffff",
      },
      flowchart: { useMaxWidth: true, htmlLabels: true, curve: "basis" },
      sequence: { useMaxWidth: true },
    });
    mermaidModule = m.default;
  }
  return mermaidModule;
}

function MermaidDiagram({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMermaid()
      .then((m) => {
        if (cancelled) return;
        const id = `mermaid-${Math.random().toString(36).slice(2, 8)}`;
        m.render(id, chart)
          .then(({ svg: s }: { svg: string }) => {
            if (!cancelled) setSvg(s);
          })
          .catch(() => {
            if (!cancelled) setError(true);
          });
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [chart]);

  useEffect(() => {
    return () => {
      document.querySelectorAll('[id^="mermaid-"][data-processed]').forEach((el) => {
        if (el.id.length < 20) el.remove();
      });
      document.querySelectorAll('[id^="dmermaid-"]').forEach((el) => {
        if (el.id.length < 20) el.remove();
      });
    };
  }, [svg]);

  if (error) {
    return (
      <pre className="docs-mermaid-error">
        <code>{chart}</code>
      </pre>
    );
  }

  return (
    <div
      ref={ref}
      className="docs-mermaid-wrap"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export default function Docs() {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState(DOC_SECTIONS[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [search, setSearch] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  const filtered = DOC_SECTIONS.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  const activeSection = DOC_SECTIONS.find((s) => s.id === activeId)!;

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeId]);

  const renderCode = useCallback(
    ({ className, children, ...rest }: any) => {
      const raw = String(children).replace(/\n$/, "");
      const match = /language-(\w+)/.exec(className || "");

      if (match && match[1] === "mermaid") {
        return <MermaidDiagram chart={raw} />;
      }

      const isBlock = match || raw.includes("\n");
      return isBlock ? (
        <SyntaxHighlighter
          style={oneLight}
          language={match ? match[1] : "text"}
          PreTag="div"
          customStyle={{
            borderRadius: 12,
            fontSize: 13,
            margin: "14px 0 20px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
            border: "1px solid #e2e8f0",
          }}
        >
          {raw}
        </SyntaxHighlighter>
      ) : (
        <code className="docs-inline-code" {...rest}>
          {children}
        </code>
      );
    },
    []
  );

  return (
    <div className="docs-root">
      <div className="docs-topbar">
        <button
          className="docs-sidebar-toggle"
          onClick={() => setSidebarOpen((v) => !v)}
          title="Toggle sidebar"
        >
          ☰
        </button>
        <button className="docs-back-btn" onClick={() => navigate("/home")}>
          ← Dashboard
        </button>
        <span className="docs-title">Builder Documentation</span>
      </div>

      <div className="docs-body">
        {sidebarOpen && (
          <nav className="docs-sidebar">
            <div className="docs-search-wrap">
              <input
                className="docs-search"
                type="text"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="docs-nav-list">
              {filtered.length === 0 ? (
                <span className="docs-nav-empty">No results</span>
              ) : (
                filtered.map((section) => (
                  <button
                    key={section.id}
                    className={`docs-nav-item${activeId === section.id ? " active" : ""}`}
                    onClick={() => setActiveId(section.id)}
                  >
                    {section.title}
                  </button>
                ))
              )}
            </div>
          </nav>
        )}

        <div className="docs-content-wrap" ref={contentRef}>
          <div className="docs-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: renderCode,
                table({ children }) {
                  return (
                    <div className="docs-table-wrap">
                      <table>{children}</table>
                    </div>
                  );
                },
              }}
            >
              {activeSection.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
