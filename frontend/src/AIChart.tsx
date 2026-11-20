import { useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
import { getAIChart, type ReportV3 } from "./reportApi";
import "./report.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface AIChartProps {
  report: ReportV3;
}

export default function AIChart({ report }: AIChartProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [chartData, setChartData] = useState<any>(null);
  const [chartType, setChartType] = useState<string>("bar");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function ask() {
    if (!question.trim()) return;
    setLoading(true);
    setError("");
    setChartData(null);
    try {
      const res = await getAIChart(question, report);
      setChartType(res.chart.type);
      setTitle(res.chart.title);
      
      const data = {
        labels: res.chart.labels,
        datasets: res.chart.datasets.map((d, index) => ({
          label: d.label,
          data: d.data,
          backgroundColor: [
            "rgba(54, 162, 235, 0.7)",
            "rgba(255, 99, 132, 0.7)",
            "rgba(255, 206, 86, 0.7)",
            "rgba(75, 192, 192, 0.7)",
            "rgba(153, 102, 255, 0.7)",
            "rgba(255, 159, 64, 0.7)",
          ][index % 6],
          borderColor: [
            "rgba(54, 162, 235, 1)",
            "rgba(255, 99, 132, 1)",
            "rgba(255, 206, 86, 1)",
            "rgba(75, 192, 192, 1)",
            "rgba(153, 102, 255, 1)",
            "rgba(255, 159, 64, 1)",
          ][index % 6],
          borderWidth: 1,
        })),
      };
      setChartData(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const renderChart = () => {
    if (!chartData) return null;
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" as const },
        title: { display: true, text: title, font: { size: 16 } },
      },
    };

    switch (chartType) {
      case "line": return <Line data={chartData} options={options} />;
      case "pie": return <Pie data={chartData} options={options} />;
      case "doughnut": return <Doughnut data={chartData} options={options} />;
      default: return <Bar data={chartData} options={options} />;
    }
  };

  return (
    <>
      {/* KITUFE CHA DUARA (Floating Button) */}
      <button 
        onClick={() => setIsOpen(true)}
        style={{
          position: "fixed", bottom: "20px", right: "20px", 
          width: "60px", height: "60px", borderRadius: "50%",
          background: "#007bff", color: "white", fontSize: "24px",
          border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          cursor: "pointer", zIndex: 1000, display: "flex",
          alignItems: "center", justifyContent: "center"
        }}
        title="Uliza AI"
      >
        🤖
      </button>

      {/* DIRISHA LA CHATI (Modal) */}
      {isOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          background: "rgba(0,0,0,0.5)", zIndex: 1001, display: "flex",
          alignItems: "center", justifyContent: "center", padding: "1rem"
        }}>
          <div style={{
            background: "white", width: "100%", maxWidth: "600px", 
            maxHeight: "90vh", overflowY: "auto", borderRadius: "12px", 
            padding: "1.5rem", position: "relative"
          }}>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ position: "absolute", top: "10px", right: "15px", background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}
            >
              ✖
            </button>
            
            <h3 style={{ marginTop: 0 }}>🤖 Msaidizi wa Data</h3>
            <p className="hint" style={{ marginBottom: "1rem" }}>
              Uliza chochote kuhusu ripoti hii. Mfano: <i>"Nichambulie service na vifaa"</i> au <i>"Nionyeshe makusanyo kwa gari"</i>.
            </p>
            
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Andika swali lako hapa..."
                style={{ flex: 1, padding: "0.8rem", borderRadius: "8px", border: "1px solid #ccc" }}
                onKeyDown={(e) => e.key === "Enter" && ask()}
              />
              <button className="btn-add" onClick={ask} disabled={loading || !question.trim()}>
                {loading ? "..." : "Tuma"}
              </button>
            </div>

            {error && <p className="error">{error}</p>}

            {chartData && (
              <div style={{ height: "350px", position: "relative", background: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid #eee" }}>
                {renderChart()}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
