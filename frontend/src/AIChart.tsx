import { useState, useRef, useEffect } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend,
} from "chart.js";
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
import { getAIChart, type ReportV3 } from "./reportApi";
import "./report.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend);

interface AIChartProps {
  report: ReportV3;
}

interface Message {
  role: "user" | "ai";
  text: string;
  chart?: any;
}

// Kazi ya kubadilisha **maneno** kuwa <strong>maneno</strong>
const formatText = (text: string) => {
  return text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
};

export default function AIChart({ report }: AIChartProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen, loading]);

  async function ask() {
    if (!input.trim() || loading) return;
    const userQ = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userQ }]);
    setLoading(true);

    try {
      const res = await getAIChart(userQ, report);
      // Tunachukua text na chart kutoka kwenye response mpya
      const aiText = res.result.text || "Samahani, sikuweza kupata jibu.";
      
      let chartPayload = null;
      if (res.result.chart) {
         chartPayload = {
            labels: res.result.chart.labels,
            datasets: res.result.chart.datasets.map((d: any, index: number) => ({
              label: d.label,
              data: d.data,
              backgroundColor: ["rgba(54, 162, 235, 0.7)", "rgba(255, 99, 132, 0.7)", "rgba(255, 206, 86, 0.7)", "rgba(75, 192, 192, 0.7)"][index % 4],
              borderColor: ["rgba(54, 162, 235, 1)", "rgba(255, 99, 132, 1)", "rgba(255, 206, 86, 1)", "rgba(75, 192, 192, 1)"][index % 4],
              borderWidth: 1,
            })),
            type: res.result.chart.type,
            title: res.result.chart.title
         };
      }

      setMessages((prev) => [...prev, { role: "ai", text: aiText, chart: chartPayload }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "ai", text: "Kuna hitilafu imetokea. Jaribu tena." }]);
    } finally {
      setLoading(false);
    }
  }

  const renderChart = (chart: any) => {
    const options = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "top" as const }, title: { display: true, text: chart.title, font: { size: 14 } } },
    };
    const data = { labels: chart.labels, datasets: chart.datasets };
    switch (chart.type) {
      case "line": return <Line data={data} options={options} />;
      case "pie": return <Pie data={data} options={options} />;
      case "doughnut": return <Doughnut data={data} options={options} />;
      default: return <Bar data={data} options={options} />;
    }
  };

  return (
    <>
      {/* Kitufe cha duara */}
      <button onClick={() => setIsOpen(true)} style={{ position: "fixed", bottom: "20px", right: "20px", width: "60px", height: "60px", borderRadius: "50%", background: "#007bff", color: "white", fontSize: "24px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
        🤖
      </button>

      {/* Chat Interface */}
      {isOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.6)", zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", padding: "0" }}>
          
          <div style={{ background: "#f4f7f6", width: "100%", maxWidth: "600px", height: "100%", maxHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
            
            {/* Kichwa cha Chat */}
            <div style={{ background: "#0056b3", color: "white", padding: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "24px" }}>🤖</span>
                <div>
                  <b style={{ fontSize: "18px" }}>ChartBot</b>
                  <div style={{ fontSize: "12px", opacity: 0.8 }}>Msaidizi wako wa biashara</div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", color: "white", fontSize: "24px", cursor: "pointer" }}>✖</button>
            </div>

            {/* Sehemu ya Ujumbe */}
            <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {messages.length === 0 && (
                <div style={{ textAlign: "center", color: "#666", marginTop: "2rem" }}>
                  <h3>Karibu kwenye ChartBot!</h3>
                  <p>Uliza swali lolote kuhusu ripoti yako. Mfano:</p>
                  <ul style={{ listStyleType: "none", padding: 0, lineHeight: "2" }}>
                    <li><i>"Nichambulie service za mwezi huu"</i></li>
                    <li><i>"Nifanye nini kuongeza faida?"</i></li>
                    <li><i>"Chora gharama za matairi"</i></li>
                  </ul>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    background: msg.role === "user" ? "#007bff" : "white",
                    color: msg.role === "user" ? "white" : "#333",
                    padding: "0.8rem 1rem", borderRadius: "12px",
                    maxWidth: "85%", boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    lineHeight: "1.5", whiteSpace: "pre-wrap"
                  }}>
                    {formatText(msg.text)}
                    
                    {msg.chart && (
                      <div style={{ height: "250px", marginTop: "1rem", background: "#fff", padding: "0.5rem", borderRadius: "8px" }}>
                        {renderChart(msg.chart)}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#666", padding: "0.5rem" }}>
                  <span className="spinner">⏳</span> ChartBot anachambua...
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Sehemu ya Kuandika */}
            <div style={{ padding: "1rem", background: "white", borderTop: "1px solid #eee", display: "flex", gap: "0.5rem" }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Andika swali lako hapa..."
                style={{ flex: 1, padding: "0.8rem", borderRadius: "20px", border: "1px solid #ccc", outline: "none" }}
                onKeyDown={(e) => e.key === "Enter" && ask()}
              />
              <button onClick={ask} disabled={loading || !input.trim()} style={{ background: "#007bff", color: "white", border: "none", borderRadius: "50%", width: "45px", height: "45px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
