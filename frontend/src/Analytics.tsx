import { useEffect, useMemo, useState, type CSSProperties } from "react";
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
  type ChartOptions,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { getReportV3, type ReportV3 } from "./reportApi";
import type { Vehicle } from "./types";
import { monthLabel } from "./format";

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

const COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#14b8a6",
];

type Period = "month" | "q1" | "q2" | "q3" | "q4" | "year" | "custom";
type ExpenseKey = "service" | "tyres" | "insurance" | "other_payments";

const EXPENSE_LABELS: Record<ExpenseKey, string> = {
  service: "Service",
  tyres: "Matairi",
  insurance: "Bima",
  other_payments: "Malipo mengine",
};

const money = (value: number) =>
  `TSh ${Number(value || 0).toLocaleString("en-US")}`;

const chartBaseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: "bottom" as const },
    tooltip: {
      callbacks: {
        label: (context: any) =>
          `${context.dataset.label || context.label}: ${money(
            Number(context.parsed?.y ?? context.parsed ?? context.raw ?? 0)
          )}`,
      },
    },
  },
};

const barOptions: ChartOptions<"bar"> = {
  ...chartBaseOptions,
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        callback: (value) => `TSh ${Number(value).toLocaleString("en-US")}`,
      },
    },
  },
};

const lineOptions: ChartOptions<"line"> = {
  ...chartBaseOptions,
  interaction: { mode: "index", intersect: false },
  elements: {
    line: { tension: 0.35, borderWidth: 3 },
    point: { radius: 4, hoverRadius: 7 },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        callback: (value) => `TSh ${Number(value).toLocaleString("en-US")}`,
      },
    },
  },
};

const doughnutOptions: ChartOptions<"doughnut"> = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: "62%",
  plugins: {
    legend: { position: "bottom" },
    tooltip: {
      callbacks: {
        label: (context) =>
          `${context.label}: ${money(Number(context.raw || 0))}`,
      },
    },
  },
};

function quarterMonths(year: string, quarter: number) {
  const first = String((quarter - 1) * 3 + 1).padStart(2, "0");
  const last = String(quarter * 3).padStart(2, "0");
  return [`${year}-${first}`, `${year}-${last}`];
}

export default function Analytics({
  vehicles,
  month,
}: {
  vehicles: Vehicle[];
  month: string;
}) {
  const initialYear = month.slice(0, 4);

  const [data, setData] = useState<ReportV3 | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<Period>("month");
  const [year, setYear] = useState(initialYear);
  const [fromMonth, setFromMonth] = useState(month);
  const [toMonth, setToMonth] = useState(month);
  const [vehicleId, setVehicleId] = useState("ALL");
  const [selectedExpense, setSelectedExpense] = useState<ExpenseKey | null>(
    null
  );

  // Keep the selected month synchronized with the parent page.
  useEffect(() => {
    if (period === "month") {
      setFromMonth(month);
      setToMonth(month);
      setYear(month.slice(0, 4));
    }
  }, [month, period]);

  function handlePeriodChange(nextPeriod: Period) {
    setPeriod(nextPeriod);
    setSelectedExpense(null);

    if (nextPeriod === "month") {
      setFromMonth(month);
      setToMonth(month);
      setYear(month.slice(0, 4));
      return;
    }

    if (nextPeriod === "custom") return;

    if (nextPeriod === "year") {
      setFromMonth(`${year}-01`);
      setToMonth(`${year}-12`);
      return;
    }

    const quarter = Number(nextPeriod.slice(1));
    const [start, end] = quarterMonths(year, quarter);
    setFromMonth(start);
    setToMonth(end);
  }

  function handleYearChange(nextYear: string) {
    setYear(nextYear);
    if (!/^\d{4}$/.test(nextYear)) return;

    if (period === "year") {
      setFromMonth(`${nextYear}-01`);
      setToMonth(`${nextYear}-12`);
    } else if (period.startsWith("q")) {
      const [start, end] = quarterMonths(nextYear, Number(period.slice(1)));
      setFromMonth(start);
      setToMonth(end);
    }
  }

  // Fetch real report data whenever the selected period or vehicle changes.
  useEffect(() => {
    if (!fromMonth || !toMonth || fromMonth > toMonth) {
      setError("Tafadhali chagua kipindi sahihi.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    getReportV3(fromMonth, toMonth, vehicleId)
      .then((report) => {
        if (!cancelled) {
          setData(report);
          setSelectedExpense(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Imeshindikana kupata takwimu. Jaribu tena."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fromMonth, toMonth, vehicleId]);

  const totals = data?.totals;
  const reportVehicles = data?.vehicles ?? [];

  const weeks = useMemo(() => {
    const maxWeek = Math.max(
      4,
      ...reportVehicles.map((vehicle) => vehicle.week_count || 0)
    );
    return Array.from({ length: maxWeek }, (_, index) => `Week ${index + 1}`);
  }, [reportVehicles]);

  // 1. Weekly income trend for each vehicle.
  const weeklyIncomeData = useMemo(
    () => ({
      labels: weeks,
      datasets: reportVehicles.map((vehicle, index) => ({
        label: vehicle.name,
        data: weeks.map(
          (_, weekIndex) =>
            vehicle.weeks.find((week) => week.number === weekIndex + 1)
              ?.amount || 0
        ),
        borderColor: COLORS[index % COLORS.length],
        backgroundColor: COLORS[index % COLORS.length],
        tension: 0.35,
        pointRadius: 4,
      })),
    }),
    [weeks, reportVehicles]
  );

  // 2. Target versus actual income.
  const targetVsActualData = useMemo(
    () => ({
      labels: reportVehicles.map((vehicle) => vehicle.name),
      datasets: [
        {
          label: "Target",
          data: reportVehicles.map((vehicle) => vehicle.target),
          backgroundColor: "#8b5cf6",
          borderRadius: 6,
        },
        {
          label: "Actual collected",
          data: reportVehicles.map((vehicle) => vehicle.collected),
          backgroundColor: "#10b981",
          borderRadius: 6,
        },
      ],
    }),
    [reportVehicles]
  );

  // 3. Expense categories. Clicking a slice drills down to the vehicles
  // contributing to that category. Item-level details need a richer API.
  const expenseKeys: ExpenseKey[] = [
    "service",
    "tyres",
    "insurance",
    "other_payments",
  ];

  const expenseValues = {
    service: totals?.service || 0,
    tyres: totals?.tyres || 0,
    insurance: totals?.insurance || 0,
    other_payments: totals?.other_payments || 0,
  };

  const expenseOverviewData = {
    labels: expenseKeys.map((key) => EXPENSE_LABELS[key]),
    datasets: [
      {
        data: expenseKeys.map((key) => expenseValues[key]),
        backgroundColor: ["#6366f1", "#f59e0b", "#10b981", "#8b5cf6"],
        borderColor: "#ffffff",
        borderWidth: 2,
      },
    ],
  };

  const expenseVehicleData = selectedExpense
    ? {
        labels: reportVehicles.map((vehicle) => vehicle.name),
        datasets: [
          {
            data: reportVehicles.map((vehicle) => vehicle[selectedExpense]),
            backgroundColor: reportVehicles.map(
              (_, index) => COLORS[index % COLORS.length]
            ),
            borderColor: "#ffffff",
            borderWidth: 2,
          },
        ],
      }
    : expenseOverviewData;

  const interactiveExpenseOptions: ChartOptions<"doughnut"> = {
    ...doughnutOptions,
    onClick: (_event, elements) => {
      if (!elements.length || selectedExpense) return;
      const clickedIndex = elements[0].index;
      const key = expenseKeys[clickedIndex];
      if (key) setSelectedExpense(key);
    },
  };

  // 4. Maintenance spending by vehicle. The current API provides costs,
  // but not repair counts or individual maintenance item records.
  const maintenanceData = {
    labels: reportVehicles.map((vehicle) => vehicle.name),
    datasets: [
      {
        label: "Service",
        data: reportVehicles.map((vehicle) => vehicle.service),
        backgroundColor: "#6366f1",
        borderRadius: 5,
      },
      {
        label: "Matairi",
        data: reportVehicles.map((vehicle) => vehicle.tyres),
        backgroundColor: "#f59e0b",
        borderRadius: 5,
      },
      {
        label: "Bima",
        data: reportVehicles.map((vehicle) => vehicle.insurance),
        backgroundColor: "#10b981",
        borderRadius: 5,
      },
    ],
  };

  // 5. Profitability per vehicle.
  const profitabilityData = {
    labels: reportVehicles.map((vehicle) => vehicle.name),
    datasets: [
      {
        label: "Net profit",
        data: reportVehicles.map((vehicle) => vehicle.profit),
        backgroundColor: reportVehicles.map((vehicle) =>
          vehicle.profit >= 0 ? "#10b981" : "#ef4444"
        ),
        borderRadius: 6,
      },
    ],
  };

  // 6. Debt and collection analysis.
  const debtData = {
    labels: reportVehicles.map((vehicle) => vehicle.name),
    datasets: [
      {
        label: "New debt",
        data: reportVehicles.map((vehicle) => vehicle.new_debt),
        backgroundColor: "#f59e0b",
        borderRadius: 5,
      },
      {
        label: "Debt payments",
        data: reportVehicles.map((vehicle) => vehicle.debt_payments),
        backgroundColor: "#10b981",
        borderRadius: 5,
      },
      {
        label: "Outstanding debt",
        data: reportVehicles.map((vehicle) => vehicle.outstanding),
        backgroundColor: "#ef4444",
        borderRadius: 5,
      },
    ],
  };

  // 7. Fleet working days versus lost days.
  const fleetPerformanceData = {
    labels: reportVehicles.map((vehicle) => vehicle.name),
    datasets: [
      {
        label: "Working days",
        data: reportVehicles.map((vehicle) => vehicle.working_days),
        backgroundColor: "#06b6d4",
        borderRadius: 5,
      },
      {
        label: "Lost days",
        data: reportVehicles.map((vehicle) => vehicle.lost_days),
        backgroundColor: "#ef4444",
        borderRadius: 5,
      },
    ],
  };

  const achievement =
    totals && totals.target > 0
      ? Math.round((totals.collected / totals.target) * 100)
      : 0;

  const periodText =
    period === "month" && fromMonth === toMonth
      ? monthLabel(fromMonth)
      : `${monthLabel(fromMonth)} – ${monthLabel(toMonth)}`;

  const cardStyle: CSSProperties = {
    padding: "18px",
    borderRadius: "18px",
    background: "var(--card-bg, #ffffff)",
    boxShadow: "0 4px 18px rgba(15, 23, 42, 0.07)",
  };

  const chartHeight: CSSProperties = {
    height: "290px",
    position: "relative",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "18px",
        paddingBottom: "40px",
      }}
    >
      {/* Period and vehicle filters */}
      <section className="card" style={{ padding: "16px" }}>
        <h2 style={{ margin: "0 0 14px", fontSize: "19px" }}>
          AdyBajaj Analytics Pro
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
            gap: "10px",
          }}
        >
          <select
            value={period}
            onChange={(event) =>
              handlePeriodChange(event.target.value as Period)
            }
            style={filterStyle}
          >
            <option value="month">Mwezi</option>
            <option value="q1">Q1 · Jan–Mar</option>
            <option value="q2">Q2 · Apr–Jun</option>
            <option value="q3">Q3 · Jul–Sep</option>
            <option value="q4">Q4 · Oct–Dec</option>
            <option value="year">Mwaka mzima</option>
            <option value="custom">Custom interval</option>
          </select>

          {period !== "month" && (
            <input
              type="number"
              min="2000"
              max="2100"
              value={year}
              onChange={(event) => handleYearChange(event.target.value)}
              aria-label="Chagua mwaka"
              style={filterStyle}
            />
          )}

          <select
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
            style={filterStyle}
            aria-label="Chagua bajaji"
          >
            <option value="ALL">Fleet nzima</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={String(vehicle.id)}>
                {vehicle.name}
              </option>
            ))}
          </select>
        </div>

        {period === "custom" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
              marginTop: "10px",
            }}
          >
            <label style={smallLabelStyle}>
              Kuanzia mwezi
              <input
                type="month"
                value={fromMonth}
                onChange={(event) => setFromMonth(event.target.value)}
                style={filterStyle}
              />
            </label>
            <label style={smallLabelStyle}>
              Mpaka mwezi
              <input
                type="month"
                value={toMonth}
                min={fromMonth}
                onChange={(event) => setToMonth(event.target.value)}
                style={filterStyle}
              />
            </label>
          </div>
        )}

        <p
          style={{
            margin: "12px 0 0",
            fontSize: "12px",
            color: "#64748b",
            textAlign: "center",
          }}
        >
          Kipindi: <b>{periodText}</b>
        </p>
      </section>

      {loading && (
        <p className="hint" style={{ textAlign: "center" }}>
          Inapakia takwimu...
        </p>
      )}

      {error && (
        <div
          role="alert"
          style={{
            padding: "13px",
            borderRadius: "12px",
            color: "#b91c1c",
            background: "#fee2e2",
          }}
        >
          {error}
        </div>
      )}

      {!loading && data && totals && (
        <>
          {/* Fleet summary */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "10px",
            }}
          >
            <SummaryCard
              label="Total income"
              value={money(totals.collected)}
              color="#2563eb"
            />
            <SummaryCard
              label="Total expenses"
              value={money(totals.expenses)}
              color="#d97706"
            />
            <SummaryCard
              label="Net profit"
              value={money(totals.profit)}
              color="#059669"
            />
            <SummaryCard
              label="Outstanding debt"
              value={money(totals.outstanding)}
              color="#dc2626"
            />
          </section>

          <section style={cardStyle}>
            <h3 style={chartTitleStyle}>1. Weekly Income Trend</h3>
            <p style={hintStyle}>
              Linganisha mwenendo wa mapato ya kila bajaji kwa wiki.
            </p>
            <div style={chartHeight}>
              <Line data={weeklyIncomeData} options={lineOptions} />
            </div>
          </section>

          <section style={cardStyle}>
            <h3 style={chartTitleStyle}>2. Target vs Actual Income</h3>
            <p style={hintStyle}>
              Target achievement: <b>{achievement}%</b> ya target ya fleet.
            </p>
            <div style={chartHeight}>
              <Bar data={targetVsActualData} options={barOptions} />
            </div>
          </section>

          <section style={cardStyle}>
            <h3 style={chartTitleStyle}>3. Expense Intelligence</h3>
            <p style={hintStyle}>
              {selectedExpense
                ? `Gharama za ${EXPENSE_LABELS[selectedExpense]} kwa kila bajaji.`
                : "Gusa sehemu ya pie chart kuona bajaji zilizochangia gharama hiyo."}
            </p>

            {selectedExpense && (
              <button
                type="button"
                onClick={() => setSelectedExpense(null)}
                style={secondaryButtonStyle}
              >
                ← Rudi kwenye matumizi yote
              </button>
            )}

            <div style={chartHeight}>
              <Doughnut
                data={expenseVehicleData}
                options={interactiveExpenseOptions}
              />
            </div>
            <p style={hintStyle}>
              Item-level breakdown na payment-method breakdown vitahitaji
              records za kina kutoka API.
            </p>
          </section>

          <section style={cardStyle}>
            <h3 style={chartTitleStyle}>4. Maintenance Cost Analysis</h3>
            <p style={hintStyle}>
              Linganisha gharama za service, matairi na bima kwa kila bajaji.
            </p>
            <div style={chartHeight}>
              <Bar
                data={maintenanceData}
                options={{
                  ...barOptions,
                  scales: {
                    ...barOptions.scales,
                    x: { stacked: false },
                    y: { ...barOptions.scales?.y, stacked: false },
                  },
                }}
              />
            </div>
            <p style={hintStyle}>
              Frequency ya repairs na idadi ya vipuri vinavyobadilishwa
              vitahitaji maintenance records zenye idadi na item.
            </p>
          </section>

          <section style={cardStyle}>
            <h3 style={chartTitleStyle}>5. Profitability per Bajaji</h3>
            <p style={hintStyle}>
              Tambua bajaji inayozalisha faida kubwa au hasara.
            </p>
            <div style={chartHeight}>
              <Bar
                data={profitabilityData}
                options={{
                  ...barOptions,
                  indexAxis: "y",
                }}
              />
            </div>
          </section>

          <section style={cardStyle}>
            <h3 style={chartTitleStyle}>6. Debt & Payment Collection</h3>
            <p style={hintStyle}>
              Linganisha madeni mapya, malipo yaliyokusanywa na deni
              linalobaki.
            </p>
            <div style={chartHeight}>
              <Bar data={debtData} options={barOptions} />
            </div>
          </section>

          <section style={cardStyle}>
            <h3 style={chartTitleStyle}>7. Fleet Performance</h3>
            <p style={hintStyle}>
              Linganisha siku za kufanya kazi na siku zilizopotea kwa kila
              bajaji.
            </p>
            <div style={chartHeight}>
              <Bar data={fleetPerformanceData} options={barOptions} />
            </div>
          </section>

          {/* Monthly trend from the API's existing series */}
          {data.series.length > 1 && (
            <section style={cardStyle}>
              <h3 style={chartTitleStyle}>Monthly Income & Profit Trend</h3>
              <p style={hintStyle}>
                Mwenendo wa mapato na faida kwa miezi iliyochaguliwa.
              </p>
              <div style={chartHeight}>
                <Line
                  data={{
                    labels: data.series.map((item) => monthLabel(item.month)),
                    datasets: [
                      {
                        label: "Collected income",
                        data: data.series.map((item) => item.collected),
                        borderColor: "#2563eb",
                        backgroundColor: "#2563eb",
                        tension: 0.35,
                      },
                      {
                        label: "Profit",
                        data: data.series.map((item) => item.profit),
                        borderColor: "#10b981",
                        backgroundColor: "#10b981",
                        tension: 0.35,
                      },
                    ],
                  }}
                  options={lineOptions}
                />
              </div>
            </section>
          )}
        </>
      )}

      {!loading && !error && !data && (
        <p className="hint" style={{ textAlign: "center" }}>
          Hakuna takwimu za kuonyesha kwa kipindi hiki.
        </p>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="card"
      style={{
        padding: "15px",
        borderRadius: "15px",
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "7px" }}>
        {label}
      </div>
      <strong
        style={{
          color,
          fontSize: "clamp(15px, 4vw, 21px)",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

const filterStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  padding: "11px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#1e293b",
  boxSizing: "border-box",
};

const smallLabelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  fontSize: "12px",
  color: "#64748b",
};

const chartTitleStyle: CSSProperties = {
  margin: "0 0 7px",
  fontSize: "16px",
  color: "#1e293b",
  textAlign: "center",
};

const hintStyle: CSSProperties = {
  margin: "0 0 14px",
  fontSize: "12px",
  color: "#64748b",
  textAlign: "center",
};

const secondaryButtonStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "9px",
  padding: "8px 12px",
  background: "#f8fafc",
  color: "#334155",
  marginBottom: "12px",
  cursor: "pointer",
};
