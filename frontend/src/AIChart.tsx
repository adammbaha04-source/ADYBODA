import { useState, useRef, useEffect } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend,
} from "chart.js";
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
import { getAIChart, type ReportV3 } from "./reportApi";
import "./report.css";

// KUSAJILI CHART.JS VIPENGELE
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend);

interface AIChartProps {
  report: ReportV3;
}

interface Message {
  role: "user" | "ai";
  text: string;
  chart?: any;
}

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
      const aiText = res.result?.text || "Samahani, sikuweza kupata majibu ya maandishi. Lakini hapa kuna data.";
      
      let chartPayload = null;
      if (res.result?.chart) {
         chartPayload = {
            labels: res.result.chart.labels,
            datasets: res.result.chart.datasets.map((d: any, index: number) => ({
              label: d.label,
              data: d.data,
              // Rangi za kisasa zaidi (Gradient feel)
              backgroundColor: [
                "rgba(0, 123, 255, 0.8)",   // Blue
                "rgba(40, 167, 69, 0.8)",   // Green
                "rgba(255, 193, 7, 0.8)",   // Yellow
                "rgba(220, 53, 69, 0.8)",   // Red
                "rgba(23, 162, 184, 0.8)"   // Teal
              ][index % 5],
              borderColor: [
                "rgba(0, 123, 255, 1)",
                "rgba(40, 167, 69, 1)",
                "rgba(255, 193, 7, 1)",
                "rgba(220, 53, 69, 1)",
                "rgba(23, 162, 184, 1)"
              ][index % 5],
              borderWidth: 1,
              borderRadius: 6, // Miondoko ya mistari (kwa bar chart)
            })),
            type: res.result.chart.type,
            title: res.result.chart.title
         };
      }

      setMessages((prev) => [...prev, { role: "ai", text: aiText, chart: chartPayload }]);
    } catch (e) {
      console.error(e);
      setMessages((prev) => [...prev, { role: "ai", text: "Kuna hitilafu kwenye mtandao au seva. Tafadhali jaribu tena baada ya muda mfupi." }]);
    } finally {
      setLoading(false);
    }
  }

  const renderChart = (chart: any) => {
    const options = {
      responsive: true, 
      maintainAspectRatio: false,
      plugins: { 
        legend: { position: "top" as const, labels: { font: { family: "sans-serif", size: 12 } } }, 
        title: { display: true, text: chart.title, font: { size: 15, family: "sans-serif", weight: "bold" as const }, padding: { bottom: 15 } } 
      },
      scales: chart.type === "bar" || chart.type === "line" ? {
        y: { beginAtZero: true, grid: { color: "#f0f0f0" } },
        x: { grid: { display: false } }
      } : undefined
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
      {/* KITUFE CHA DUARA (Floating Button) - Sasa kina Logo */}
      <button 
        onClick={() => setIsOpen(true)} 
        style={{ 
          position: "fixed", bottom: "20px", right: "20px", 
          width: "60px", height: "60px", borderRadius: "50%", 
          background: "#fff", border: "2px solid #0056b3", padding: "5px",
          boxShadow: "0 4px 15px rgba(0,86,179,0.4)", zIndex: 1000, 
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", overflow: "hidden"
        }}
      >
        <img src="/logo.png" alt="ChatBot" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </button>

      {/* DIRISHA LA CHAT */}
      {isOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.6)", zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", padding: "0" }}>
          
          <div style={{ background: "#f8f9fa", width: "100%", maxWidth: "600px", height: "100%", maxHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
            
            {/* KICHWA CHA CHAT - Sasa kina Logo */}
            <div style={{ background: "#0056b3", color: "white", padding: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ background: "white", borderRadius: "50%", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", padding: "4px" }}>
                  <img src="/logo.png" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
                <div>
                  <b style={{ fontSize: "18px", letterSpacing: "0.5px" }}>ChartBot</b>
                  <div style={{ fontSize: "12px", opacity: 0.8 }}>Msaidizi wako wa biashara</div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", color: "white", fontSize: "24px", cursor: "pointer", opacity: 0.8 }}>✖</button>
            </div>

            {/* SEHEMU YA UJUMBE */}
            <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              {messages.length === 0 && (
                <div style={{ textAlign: "center", color: "#666", marginTop: "3rem", padding: "0 1rem" }}>
                  <img src="/logo.png" alt="Logo" style={{ width: "80px", opacity: 0.8, marginBottom: "1rem" }} />
                  <h3 style={{ color: "#333" }}>Karibu kwenye ChartBot!</h3>
                  <p style={{ fontSize: "14px", lineHeight: "1.6" }}>Uliza swali lolote kuhusu ripoti yako. Mfano:</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "1.5rem" }}>
                    <div style={{ background: "white", padding: "12px", borderRadius: "10px", fontSize: "14px", boxShadow: "0 2px 5px rgba(0,0,0,0.05)", border: "1px solid #eaeaea" }}>"Nichambulie service za mwezi huu"</div>
                    <div style={{ background: "white", padding: "12px", borderRadius: "10px", fontSize: "14px", boxShadow: "0 2px 5px rgba(0,0,0,0.05)", border: "1px solid #eaeaea" }}>"Nifanye nini kuongeza faida?"</div>
                    <div style={{ background: "white", padding: "12px", borderRadius: "10px", fontSize: "14px", boxShadow: "0 2px 5px rgba(0,0,0,0.05)", border: "1px solid #eaeaea" }}>"Chora gharama za matairi"</div>
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    background: msg.role === "user" ? "#0056b3" : "white",
                    color: msg.role === "user" ? "white" : "#333",
                    padding: "12px 16px", 
                    borderRadius: msg.role === "user" ? "18px 18px 0 18px" : "18px 18px 18px 0",
                    maxWidth: "85%", 
                    boxShadow: "0 2px 5px rgba(0,0,0,0.08)",
                    lineHeight: "1.5", 
                    whiteSpace: "pre-wrap",
                    fontSize: "15px"
                  }}>
                    {formatText(msg.text)}
                    
                    {/* CHATI ILIYOBORESHWA */}
                    {msg.chart && (
                      <div style={{ 
                        marginTop: "1rem", background: "#fff", padding: "10px", 
                        borderRadius: "12px", border: "1px solid #eee",
                        boxShadow: "inset 0 0 10px rgba(0,0,0,0.02)",
                        height: "260px", width: "100%", minWidth: "280px"
                      }}>
                        {renderChart(msg.chart)}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#666", padding: "0.5rem", fontSize: "14px" }}>
                  <img src="/logo.png" alt="Loading" style={{ width: "20px", animation: "spin 1s linear infinite" }} /> 
                  ChartBot anachambua...
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* SEHEMU YA KUANDIKA */}
            <div style={{ padding: "1rem", background: "white", borderTop: "1px solid #eee", display: "flex", gap: "0.8rem", alignItems: "center" }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Andika swali lako hapa..."
                style={{ flex: 1, padding: "12px 18px", borderRadius: "25px", border: "1px solid #ddd", outline: "none", fontSize: "15px", background: "#f8f9fa" }}
                onKeyDown={(e) => e.key === "Enter" && ask()}
              />
              <button 
                onClick={ask} 
                disabled={loading || !input.trim()} 
                style={{ 
                  background: loading || !input.trim() ? "#a0c4ff" : "#0056b3", 
                  color: "white", border: "none", borderRadius: "50%", 
                  width: "48px", height: "48px", cursor: loading ? "not-allowed" : "pointer", 
                  display: "flex", alignItems: "center", justifyContent: "center", 
                  fontSize: "20px", boxShadow: "0 2px 8px rgba(0,86,179,0.3)", transition: "0.2s"
                }}
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
