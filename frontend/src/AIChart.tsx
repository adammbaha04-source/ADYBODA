import { useState, useRef, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
import { getAIChart, downloadReportPdf, type ReportV3 } from "./reportApi";
import "./report.css";
import "./chartbot.css";
import "./chartbot-pdf-action.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend
);

interface AIChartProps {
  report: ReportV3;
  autoOpen?: boolean;
  onClose?: () => void;
}

interface Message {
  role: "user" | "ai";
  text: string;
  charts?: any[];
  action?: "download-report-pdf";
  pdfStatus?: "idle" | "loading" | "success" | "error";
}

const QUICK_PROMPTS = [
  {
    icon: "📊",
    title: "Ripoti ya biashara",
    text: "Nichambulia ripoti ya biashara yangu mwezi huu",
    category: "UCHAMBUZI",
  },
  {
    icon: "💰",
    title: "Faida na mapato",
    text: "Faida yangu ni kiasi gani na imebadilikaje?",
    category: "FEDHA",
  },
  {
    icon: "🧾",
    title: "Matumizi binafsi",
    text: "Matumizi yangu binafsi mwezi huu yapoje? Nipe uchambuzi kwa items na ushauri ipi ipunguzwe",
    category: "MATUMIZI",
  },
  {
    icon: "🛠️",
    title: "Huduma za magari",
    text: "Nichambulia service za magari yangu mwezi huu",
    category: "MATENGENEZO",
  },
  {
    icon: "💳",
    title: "Malipo",
    text: "Chambua malipo yote mwezi huu (TRA, maegesho, faini, deni)",
    category: "MALIPO",
  },
  {
    icon: "⛽",
    title: "Matumizi ya mafuta",
    text: "Chambua matumizi ya mafuta kwa bajaji zangu",
    category: "MATUMIZI",
  },
  {
    icon: "🚀",
    title: "Kuongeza faida",
    text: "Nifanye nini kuongeza faida ya biashara yangu?",
    category: "USHAURI",
  },
  {
    icon: "⚠️",
    title: "Changamoto",
    text: "Tambua changamoto kubwa katika biashara yangu",
    category: "UCHAMBUZI",
  },
];

const COLORS = [
  "#1677FF",
  "#12B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
  "#EC4899",
  "#84CC16",
  "#F97316",
  "#64748B",
];

const CIRCULAR_TYPES = ["pie", "doughnut", "halfpie"];

const formatNumber = (value: any) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : String(value);
};

// PDF requests are app actions, not questions for the language model.
// This first version exports the report currently selected on the Reports page.
const isPdfRequest = (question: string): boolean => {
  // Normalize Swahili text and recognize direct requests such as
  // "Niandalie pdf", "Nipe PDF", "Pakua ripoti", and "Download report".
  const normalized = question
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .trim();

  return (
    /\\b(pdf|pakua|kupakua|download|print|chapisha)\\b/i.test(normalized) ||
    /\\b(niandalie|nitengenezee|tengeneza|nahitaji|nataka|nipe)\\b.{0,45}\\b(ripoti|report|pdf)\\b/i.test(normalized) ||
    /\\b(ripoti|report)\\b.{0,30}\\b(ya|kwa|la)\\b.{0,20}\\b(pdf|download)\\b/i.test(normalized)
  );
};

const formatText = (text: string) => {
  return text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
};

// Turns one chart from the server into the data Chart.js needs.
const buildChartPayload = (chart: any) => {
  const circular = CIRCULAR_TYPES.includes(chart.type);
  return {
    labels: chart.labels,
    datasets: chart.datasets.map((d: any, index: number) => ({
      label: d.label,
      data: d.data,
      backgroundColor: circular
        ? chart.labels.map((_: any, i: number) => COLORS[i % COLORS.length])
        : COLORS[index % COLORS.length],
      borderColor: circular ? "#FFFFFF" : COLORS[index % COLORS.length],
      borderWidth: 2,
      borderRadius: circular ? 0 : 8,
      tension: 0.4,
      fill: false,
    })),
    type: chart.type,
    title: chart.title,
  };
};

export default function AIChart({ report, autoOpen = false, onClose }: AIChartProps) {
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [messages, isOpen, loading]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      inputRef.current?.focus();
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  async function handlePdfDownload(messageIndex: number) {
    setMessages((prev) =>
      prev.map((message, index) =>
        index === messageIndex ? { ...message, pdfStatus: "loading" } : message
      )
    );

    try {
      await downloadReportPdf(
        report.from,
        report.to,
        report.vehicle_id == null ? "ALL" : String(report.vehicle_id)
      );
      setMessages((prev) =>
        prev.map((message, index) =>
          index === messageIndex ? { ...message, pdfStatus: "success" } : message
        )
      );
    } catch (error) {
      console.error("CHARTBOT_PDF_EXPORT_FAILED", error);
      const detail =
        error instanceof Error && error.message
          ? error.message
          : "Imeshindikana kuandaa PDF. Hakikisha umeingia kama Owner na ujaribu tena.";
      setMessages((prev) =>
        prev.map((message, index) =>
          index === messageIndex
            ? {
                ...message,
                text: `Imeshindikana kupakua PDF. ${detail}`,
                pdfStatus: "error",
              }
            : message
        )
      );
    }
  }

  async function ask(customQuestion?: string) {
    const q = (customQuestion ?? input).trim();

    if (!q || loading) return;

    setInput("");

    setMessages((prev) => [
      ...prev,
      { role: "user", text: q },
    ]);

    // Export is executed by the authenticated backend PDF endpoint.
    // Groq is not asked to generate a file or invent PDF content.
    if (isPdfRequest(q)) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: `Naweza kukuandalia PDF ya ripoti iliyochaguliwa kwenye ukurasa wa Reports: ${report.from} hadi ${report.to}. Bonyeza kitufe cha kupakua hapa chini. Kwa sasa hii ni ripoti kamili ya biashara, si ripoti maalumu ya service pekee.`,
          action: "download-report-pdf",
          pdfStatus: "idle",
        },
      ]);
      return;
    }

    setLoading(true);

    try {
      const res = await getAIChart(q, report);
      const result: any = res.result;

      const aiText = result?.text || "Samahani, sikuweza kupata majibu.";

      // The server sends "charts" (up to 3). Older replies had a single "chart".
      const rawCharts: any[] = Array.isArray(result?.charts)
        ? result.charts
        : result?.chart
          ? [result.chart]
          : [];

      const charts = rawCharts
        .filter((c: any) => c && Array.isArray(c.labels) && Array.isArray(c.datasets))
        .map(buildChartPayload);

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: aiText,
          charts,
        },
      ]);
    } catch (error) {
      console.error(error);

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Kuna hitilafu kwenye mtandao au seva. Tafadhali jaribu tena baadaye.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function renderChart(chart: any) {
    const isHalf = chart.type === "halfpie";
    const isCircular = CIRCULAR_TYPES.includes(chart.type);

    const options: any = {
      responsive: true,
      maintainAspectRatio: false,

      interaction: {
        intersect: isCircular,
        mode: isCircular ? "nearest" : "index",
      },

      ...(isHalf
        ? { rotation: -90, circumference: 180, cutout: "55%" }
        : {}),

      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            padding: 18,
            color: "#64748B",
            font: {
              size: 11,
              family: "inherit",
            },
          },
        },

        title: {
          display: !!chart.title,
          text: chart.title,
          color: "#172554",
          font: {
            size: 14,
            weight: "bold",
          },
          padding: {
            bottom: 20,
          },
        },

        tooltip: {
          backgroundColor: "#10264B",
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: (ctx: any) => {
              const value = isCircular ? ctx.parsed : ctx.parsed?.y;
              const label = isCircular ? ctx.label : ctx.dataset?.label;
              return `${label ?? ""}: ${formatNumber(value)}`;
            },
          },
        },
      },

      scales:
        chart.type === "bar" || chart.type === "line"
          ? {
              y: {
                beginAtZero: true,
                grid: {
                  color: "#F1F5F9",
                },
                border: {
                  display: false,
                },
                ticks: {
                  color: "#94A3B8",
                  callback: (value: any) => formatNumber(value),
                },
              },

              x: {
                grid: {
                  display: false,
                },
                border: {
                  display: false,
                },
                ticks: {
                  color: "#64748B",
                },
              },
            }
          : undefined,
    };

    const data = {
      labels: chart.labels,
      datasets: chart.datasets,
    };

    switch (chart.type) {
      case "line":
        return <Line data={data} options={options} />;

      case "pie":
        return <Pie data={data} options={options} />;

      case "doughnut":
      case "halfpie":
        return <Doughnut data={data} options={options} />;

      default:
        return <Bar data={data} options={options} />;
    }
  }

  function clearChat() {
    if (loading) return;
    setMessages([]);
    setInput("");
  }

  return (
    <>
      {/* FLOATING AI BUTTON */}
      {!isOpen && !autoOpen && (
        <button
          className="chartbot-float"
          onClick={() => setIsOpen(true)}
          aria-label="Fungua ChartBot"
        >
          <img
            src="/logo.png"
            alt="ChartBot"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <span className="chartbot-float-dot" />
        </button>
      )}

      {isOpen && (
        <div className="chartbot-overlay">
          <section className="chartbot-window">

            {/* HEADER */}
            <header className="chartbot-header">
              <div className="chartbot-brand">
                <div className="chartbot-avatar">
                  <img
                    src="/logo.png"
                    alt="ChartBot AI"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>

                <div className="chartbot-brand-info">
                  <div className="chartbot-title">
                    ChartBot
                    <span className="chartbot-pro">PRO</span>
                  </div>

                  <div className="chartbot-status">
                    <span className="online-dot" />
                    Msaidizi wako wa biashara
                  </div>
                </div>
              </div>

              <div className="chartbot-header-actions">
                <button
                  className="chartbot-header-btn"
                  onClick={clearChat}
                  disabled={messages.length === 0 || loading}
                  title="Anza mazungumzo mapya"
                >
                  ↻
                </button>

                <button
                  className="chartbot-close"
                  onClick={() => { setIsOpen(false); onClose?.(); }}
                  aria-label="Funga ChartBot"
                >
                  ×
                </button>
              </div>
            </header>

            {/* CHAT BODY */}
            <main className="chartbot-body">

              {messages.length === 0 && (
                <div className="chartbot-welcome">

                  <div className="welcome-glow">
                    <div className="welcome-robot">
                      <img
                        src="/logo.png"
                        alt="AI Robot"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                      <span>AI</span>
                    </div>
                  </div>

                  <div className="welcome-label">
                    <span>✦</span> YOUR AI BUSINESS ANALYST
                  </div>

                  <h2>
                    Habari! 👋
                    <br />
                    <span>Nikusaidie kuchambua biashara yako?</span>
                  </h2>

                  <p className="welcome-description">
                    Uliza chochote kuhusu mapato, matumizi,
                    madeni, service na utendaji wa bajaji zako.
                    Nitakupa uchambuzi na mapendekezo
                    yanayotokana na ripoti yako.
                  </p>

                  <div className="quick-heading">
                    <div>
                      <strong>Jaribu kuuliza</strong>
                      <small>MASWALI YA HARAKA</small>
                    </div>
                    <span>✦</span>
                  </div>

                  <div className="quick-grid">
                    {QUICK_PROMPTS.map((item, index) => (
                      <button
                        key={index}
                        className="quick-card"
                        onClick={() => ask(item.text)}
                        disabled={loading}
                      >
                        <div className="quick-card-top">
                          <span className="quick-icon">
                            {item.icon}
                          </span>
                          <span className="quick-arrow">↗</span>
                        </div>

                        <small>{item.category}</small>
                        <strong>{item.title}</strong>
                        <span className="quick-description">
                          {item.text}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="chartbot-trust">
                    <span>🔒</span>
                    Uchambuzi unatokana na taarifa za biashara yako
                  </div>
                </div>
              )}

              {/* MESSAGES */}
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`message-row ${msg.role}`}
                >
                  {msg.role === "ai" && (
                    <div className="message-avatar">
                      <img src="/logo.png" alt="AI" />
                    </div>
                  )}

                  <div className="message-content">
                    <div className="message-name">
                      {msg.role === "ai" ? "ChartBot AI" : "Wewe"}
                      {msg.role === "ai" && (
                        <span className="ai-tag">ANALYST</span>
                      )}
                    </div>

                    <div className={`message-bubble ${msg.role}`}>
                      <div className="message-text">
                        {formatText(msg.text)}
                      </div>

                      {msg.charts && msg.charts.map((chart, chartIdx) => (
                        <div className="chart-result-card" key={chartIdx}>
                          <div className="chart-card-heading">
                            <span>📊</span>
                            <strong>Business Analytics</strong>
                            <span className="chart-card-badge">
                              LIVE DATA
                            </span>
                          </div>

                          <div className="chart-container">
                            {renderChart(chart)}
                          </div>
                        </div>
                      ))}

                      {msg.action === "download-report-pdf" && (
                        <div className="chartbot-pdf-action">
                          <div className="chartbot-pdf-file">
                            <span className="chartbot-pdf-file-icon">PDF</span>
                            <span className="chartbot-pdf-file-info">
                              <strong>Ripoti ya biashara</strong>
                              <small>{report.from} — {report.to}</small>
                              <small>
                                {report.vehicle_id == null
                                  ? "Magari yote"
                                  : "Gari lililochaguliwa"}
                              </small>
                            </span>
                          </div>
                          <button
                            type="button"
                            className="chartbot-pdf-button"
                            onClick={() => handlePdfDownload(idx)}
                            disabled={msg.pdfStatus === "loading"}
                          >
                            {msg.pdfStatus === "loading"
                              ? "Inaandaliwa..."
                              : msg.pdfStatus === "success"
                                ? "Pakua tena PDF"
                                : msg.pdfStatus === "error"
                                  ? "Jaribu tena"
                                  : "Pakua PDF"}
                          </button>
                          {msg.pdfStatus === "success" && (
                            <small className="chartbot-pdf-success">
                              PDF imeandaliwa na kutumwa kwenye downloads.
                            </small>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* LOADING */}
              {loading && (
                <div className="message-row ai">
                  <div className="message-avatar">
                    <img src="/logo.png" alt="AI" />
                  </div>

                  <div className="thinking-card">
                    <div className="thinking-dots">
                      <span />
                      <span />
                      <span />
                    </div>

                    <div>
                      <strong>ChartBot anachambua...</strong>
                      <small>
                        Inasoma taarifa na kutengeneza uchambuzi
                      </small>
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </main>

            {/* INPUT AREA */}
            <footer className="chartbot-footer">
              <div className="input-helper">
                <span>✦</span>
                Uliza ChartBot kuhusu biashara yako
              </div>

              <form
                className="chartbot-input-box"
                onSubmit={(e) => {
                  e.preventDefault();
                  ask();
                }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Andika swali lako hapa..."
                  disabled={loading}
                />

                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  aria-label="Tuma swali"
                >
                  {loading ? "..." : "➤"}
                </button>
              </form>

              <div className="footer-note">
                ChartBot inaweza kufanya makosa.
                Hakiki taarifa muhimu za biashara yako.
              </div>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
