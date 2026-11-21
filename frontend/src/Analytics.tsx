import { useEffect, useState } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { getReportV3, type ReportV3 } from "./reportApi";
import type { Vehicle } from "./types";
import { tsh } from "./format";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend);

export default function Analytics({ vehicles, month }: { vehicles: Vehicle[], month: string }) {
  const [data, setData] = useState<ReportV3 | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Tunachukua data ya mwezi mmoja kwa ajili ya Dashboard
    getReportV3(month, month, "ALL")
      .then((d) => setData(d))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [month, vehicles.length]);

  if (loading) return <p className="hint">Inapakia takwimu...</p>;
  if (!data) return <p className="error">Imeshindwa kupata takwimu.</p>;

  const t = data.totals;

  // 1. Data ya Chati ya Mapato kwa Gari (Bar Chart)
  const barChartData = {
    labels: data.vehicles.map((v) => v.name),
    datasets: [
      {
        label: "Mapato (TSh)",
        data: data.vehicles.map((v) => v.collected),
        backgroundColor: "rgba(0, 123, 255, 0.8)",
        borderRadius: 6,
      },
      {
        label: "Matumizi (TSh)",
        data: data.vehicles.map((v) => v.expenses),
        backgroundColor: "rgba(220, 53, 69, 0.8)",
        borderRadius: 6,
      },
    ],
  };

  // 2. Data ya Chati ya Matumizi kwa Aina (Doughnut)
  const doughnutData = {
    labels: ["Service", "Matairi (Tyres)", "Bima (Insurance)", "Mengineyo"],
    datasets: [
      {
        data: [t.service, t.tyres, t.insurance, t.other_payments],
        backgroundColor: ["#1677FF", "#12B981", "#F59E0B", "#EF4444"],
        borderWidth: 0,
      },
    ],
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", paddingBottom: "40px" }}>
      
      {/* KPI CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div className="card" style={{ background: "linear-gradient(135deg, #1677FF, #0a4bb5)", color: "white", padding: "16px" }}>
          <p style={{ margin: 0, fontSize: "12px", opacity: 0.9 }}>MAPATO YOTE</p>
          <h2 style={{ margin: "8px 0 0", fontSize: "22px" }}>{tsh(t.collected)}</h2>
        </div>
        <div className="card" style={{ background: "linear-gradient(135deg, #12B981, #0d8a60)", color: "white", padding: "16px" }}>
          <p style={{ margin: 0, fontSize: "12px", opacity: 0.9 }}>FAIDA HALISI</p>
          <h2 style={{ margin: "8px 0 0", fontSize: "22px" }}>{tsh(t.profit)}</h2>
        </div>
        <div className="card" style={{ background: "linear-gradient(135deg, #F59E0B, #c27400)", color: "white", padding: "16px" }}>
          <p style={{ margin: 0, fontSize: "12px", opacity: 0.9 }}>MATUMIZI</p>
          <h2 style={{ margin: "8px 0 0", fontSize: "22px" }}>{tsh(t.expenses + t.personal)}</h2>
        </div>
        <div className="card" style={{ background: "linear-gradient(135deg, #EF4444, #b91c1c)", color: "white", padding: "16px" }}>
          <p style={{ margin: 0, fontSize: "12px", opacity: 0.9 }}>DENI</p>
          <h2 style={{ margin: "8px 0 0", fontSize: "22px" }}>{tsh(t.outstanding)}</h2>
        </div>
      </div>

      {/* CHATI YA MAPATO KWA GARI */}
      <div className="card" style={{ padding: "16px" }}>
        <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: "15px" }}>📊 Mapato na Matumizi kwa Gari</h3>
        <div style={{ height: "300px" }}>
          <Bar data={barChartData} options={{ responsive: true, maintainAspectRatio: false }} />
        </div>
      </div>

      {/* CHATI YA MATUMIZI */}
      <div className="card" style={{ padding: "16px" }}>
        <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: "15px" }}>🛠️ Mchanganuo wa Matumizi</h3>
        <div style={{ height: "250px" }}>
          <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, cutout: "70%" }} />
        </div>
      </div>

    </div>
  );
}
