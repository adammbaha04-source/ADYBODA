import { useEffect, useState } from "react";
import AIChart from "./AIChart";
import { getReportV3, type ReportV3 } from "./reportApi";
import type { Vehicle } from "./types";

// Ukurasa wa ChartBot kwenye menyu. Unapakia ripoti ya mwezi, kisha unafungua ChartBot.
export default function AIChatPage({
  vehicles,
  month,
  onClose,
}: {
  vehicles: Vehicle[];
  month: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ReportV3 | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    setError("");
    getReportV3(month, month, "ALL")
      .then((d) => setData(d))
      .catch((e: Error) => setError(e.message));
  }, [month, vehicles.length]);

  if (error) {
    return (
      <section className="card">
        <p className="error">{error}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="card">
        <p className="hint">Inapakia ChartBot...</p>
      </section>
    );
  }

  return <AIChart report={data} autoOpen onClose={onClose} />;
}
