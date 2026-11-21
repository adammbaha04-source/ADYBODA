import { useEffect, useState } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { getReportV3, type ReportV3 } from "./reportApi";
import type { Vehicle } from "./types";
import { tsh, monthLabel } from "./format";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend);

// Rangi za kisasa
const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

type PeriodType = "month" | "q1" | "q2" | "q3" | "q4" | "year";

export default function Analytics({ vehicles, month }: { vehicles: Vehicle[], month: string }) {
  const [data, setData] = useState<ReportV3 | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<PeriodType>("month");
  
  // Kuchagua kipindi
  const currentYear = month.split("-")[0];
  const [fromMonth, setFromMonth] = useState(month);
  const [toMonth, setToMonth] = useState(month);

  // Function ya kubadilisha kipindi
  function handlePeriodChange(type: PeriodType) {
    setPeriod(type);
    if (type === "month") {
      setFromMonth(month);
      setToMonth(month);
    } else if (type === "year") {
      setFromMonth(`${currentYear}-01`);
      setToMonth(`${currentYear}-12`);
    } else {
      const q = Number(type.slice(1));
      const start = String(q * 3 - 2).padStart(2, "0");
      const end = String(q * 3).padStart(2, "0");
      setFromMonth(`${currentYear}-${start}`);
      setToMonth(`${currentYear}-${end}`);
    }
  }

  // Chukua data
  function generateGraphs() {
    setLoading(true);
    getReportV3(fromMonth, toMonth, "ALL")
      .then((d) => setData(d))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }

  // Pakia data ya mwanzo
  useEffect(() => {
    generateGraphs();
  }, [vehicles.length]);

  if (!data && !loading) return <p className="hint">Bonyeza "Tengeneza Grafu" kuanza.</p>;

  const t = data?.totals;

  // 1. Line Chart: Weekly Income
  // Tunachukua wiki 1 hadi 5 kutoka kwenye gari la kwanza
  const maxWeek = Math.max(4, ...(data?.vehicles.map((v) => v.week_count) || [4]));
  const weeks = Array.from({ length: maxWeek }, (_, i) => `Week ${i + 1}`);
  
  const lineDatasets = data?.vehicles.map((v, index) => ({
    label: v.name,
    data: weeks.map((_, i) => v.weeks.find((w) => w.number === i + 1)?.amount || 0),
    borderColor: COLORS[index % COLORS.length],
    backgroundColor: COLORS[index % COLORS.length],
    tension: 0.4,
    pointRadius: 5,
    pointHoverRadius: 7,
  })) || [];

  const lineChartData = { labels: weeks, datasets: lineDatasets };

  // 2. Doughnut Chart: Expenses by Category
  const doughnutData = {
    labels: ["Service", "Malipo (Other)", "Mengineyo"],
    datasets: [
      {
        data: [t?.service || 0, t?.other_payments || 0, (t?.tyres || 0) + (t?.insurance || 0)],
        backgroundColor: ["#6366f1", "#f59e0b", "#8b5cf6"],
        borderWidth: 0,
      },
    ],
  };

  // 3. Bar Chart: Service & Items (Tunatumia kile kilichopo kwenye totals)
  const serviceItemsData = {
    labels: ["Service", "Matairi (Tyres)", "Bima (Insurance)"],
    datasets: [
      {
        label: "Gharama (TSh)",
        data: [t?.service || 0, t?.tyres || 0, t?.insurance || 0],
        backgroundColor: ["#6366f1", "#f59e0b", "#10b981"],
        borderRadius: 6,
      },
    ],
  };

  // 4. Bar Chart: Target vs Actual
  const targetVsActualData = {
    labels: data?.vehicles.map((v) => v.name) || [],
    datasets: [
      {
        label: "Target (TSh)",
        data: data?.vehicles.map((v) => v.target) || [],
        backgroundColor: "#8b5cf6",
        borderRadius: 6,
      },
      {
        label: "Actual Income (TSh)",
        data: data?.vehicles.map((v) => v.collected) || [],
        backgroundColor: "#10b981",
        borderRadius: 6,
      },
    ],
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", paddingBottom: "40px" }}>
      
      {/* VITUFE VYA KIPINDI */}
      <div className="card" style={{ padding: "16px" }}>
        <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
          <select 
            value={period} 
            onChange={(e) => handlePeriodChange(e.target.value as PeriodType)}
            style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
          >
            <option value="month">Mwezi ({monthLabel(month)})</option>
            <option value="q1">Q1 (Jan - Mar)</option>
            <option value="q2">Q2 (Apr - Jun)</option>
            <option value="q3">Q3 (Jul - Sep)</option>
            <option value="q4">Q4 (Oct - Dec)</option>
            <option value="year">Mwaka Mzima ({currentYear})</option>
          </select>
          
          <button 
            onClick={generateGraphs} 
            disabled={loading}
            style={{ flex: 1, padding: "10px", borderRadius: "8px", background: "#4f46e5", color: "white", border: "none", fontWeight: "bold", cursor: "pointer" }}
          >
            {loading ? "Inatengeneza..." : "Tengeneza Grafu"}
          </button>
        </div>
        <p style={{ margin: 0, fontSize: "12px", color: "#64748b", textAlign: "center" }}>
          Kipindi: <b>{monthLabel(fromMonth)} - {monthLabel(toMonth)}</b>
        </p>
      </div>

      {loading && <p className="hint" style={{ textAlign: "center" }}>Inapakia takwimu...</p>}

      {!loading && data && t && (
        <>
          {/* CHATI 1: WEEKLY INCOME */}
          <div className="card" style={{ padding: "20px" }}>
            <h3 style={{ marginTop: 0, marginBottom: "20px", fontSize: "16px", color: "#1e293b", textAlign: "center" }}>
              Weekly Income for {period === "month" ? monthLabel(month) : "Selected Period"}
            </h3>
            <div style={{ height: "300px" }}>
              <Line data={lineChartData} options={{ 
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: "top" } },
                scales: { y: { beginAtZero: true } }
              }} />
            </div>
          </div>

          {/* CHATI 2: EXPENSES */}
          <div className="card" style={{ padding: "20px" }}>
            <h3 style={{ marginTop: 0, marginBottom: "20px", fontSize: "16px", color: "#1e293b", textAlign: "center" }}>
              Expenses by Category - {period === "month" ? monthLabel(month) : "Selected Period"}
            </h3>
            <div style={{ height: "300px" }}>
              <Doughnut data={doughnutData} options={{ 
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: "right" } },
                cutout: "60%"
              }} />
            </div>
          </div>

          {/* CHATI 3: SERVICE & ITEMS */}
          <div className="card" style={{ padding: "20px" }}>
            <h3 style={{ marginTop: 0, marginBottom: "20px", fontSize: "16px", color: "#1e293b", textAlign: "center" }}>
              Service & Matumizi kwa Kitu
            </h3>
            <div style={{ height: "300px" }}>
              <Bar data={serviceItemsData} options={{ 
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
              }} />
            </div>
          </div>

          {/* CHATI 4: TARGET VS ACTUAL */}
          <div className="card" style={{ padding: "20px" }}>
            <h3 style={{ marginTop: 0, marginBottom: "20px", fontSize: "16px", color: "#1e293b", textAlign: "center" }}>
              Target vs Actual Income
            </h3>
            <div style={{ height: "300px" }}>
              <Bar data={targetVsActualData} options={{ 
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: "top" } },
                scales: { y: { beginAtZero: true } }
              }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
