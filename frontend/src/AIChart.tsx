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
import "./report.css"; // Kuchukua styles zilizopo

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
      
      // Tunatengeneza muundo wa data unaotakiwa na Chart.js
      const data = {
        labels: res.chart.labels,
        datasets: res.chart.datasets.map((d, index) => ({
          label: d.label,
          data: d.data,
          backgroundColor: [
            "rgba(54, 162, 235, 0.6)",
            "rgba(255, 99, 132, 0.6)",
            "rgba(255, 206, 86, 0.6)",
            "rgba(75, 192, 192, 0.6)",
            "rgba(153, 102, 255, 0.6)",
            "rgba(255, 159, 64, 0.6)",
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
      case "line":
        return <Line data={chartData} options={options} />;
      case "pie":
        return <Pie data={chartData} options={options} />;
      case "doughnut":
        return <Doughnut data={chartData} options={options} />;
      default:
        return <Bar data={chartData} options={options} />;
    }
  };

  return (
    <div className="card no-print" style={{ marginTop: "1.5rem" }}>
      <h3>📊 Chora Chati kwa AI</h3>
      <p className="hint" style={{ marginBottom: "1rem" }}>
        Andika swali lako hapa chini. Mfano: <i>"Nionyeshe makusanyo kwa kila gari"</i> au <i>"Chora gharama za November"</i>.
      </p>
      
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Uliza kitu kuhusu ripoti hii..."
          style={{ flex: 1, padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }}
          onKeyDown={(e) => e.key === "Enter" && ask()}
        />
        <button className="btn-add" onClick={ask} disabled={loading || !question.trim()}>
          {loading ? "Inachora..." : "Chora Chati"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {chartData && (
        <div style={{ height: "400px", position: "relative", background: "#fff", padding: "1rem", borderRadius: "8px" }}>
          {renderChart()}
        </div>
      )}
    </div>
  );
}
