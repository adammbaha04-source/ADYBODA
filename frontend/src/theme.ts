// Appearance: background palettes and dark mode, applied from the user's saved settings.
export const PALETTES: Record<string, [string, string, string]> = {
  adybajaj: ["#6366f1", "#8b5cf6", "#ec4899"],
  ocean: ["#0ea5e9", "#2563eb", "#06b6d4"],
  emerald: ["#065f46", "#10b981", "#14b8a6"],
  sunset: ["#ea580c", "#f97316", "#eab308"],
  violet: ["#7c3aed", "#a855f7", "#ec4899"],
};
export const BACKGROUND_LABELS: Record<string, string> = {
  adybajaj: "AdyBajaj", ocean: "Ocean", emerald: "Emerald", sunset: "Sunset", violet: "Violet",
};

export function applyAppearance(p: { theme: string; background: string; accent: string }): void {
  const pal = PALETTES[p.background] ?? PALETTES.adybajaj;
  const root = document.documentElement;
  const body = document.body;
  root.style.setProperty("--brand-grad", `linear-gradient(135deg, ${pal[0]} 0%, ${pal[1]} 50%, ${pal[2]} 100%)`);
  root.style.setProperty("--brand-2", p.accent || pal[1]);
  root.style.setProperty("--accent", p.accent || pal[1]);
  const dark = p.theme === "dark";
  body.classList.toggle("theme-dark", dark);
  body.style.backgroundColor = dark ? "#0b1020" : "#f3f4f8";
  body.style.backgroundImage =
    `radial-gradient(at 0% 0%, ${pal[0]}b3 0px, transparent 55%), radial-gradient(at 100% 100%, ${pal[2]}8c 0px, transparent 55%)`;
}

/** Resize a picked image to a small JPEG data URL so it stays well under the server limit. */
export function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Imeshindikana kusoma picha."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Faili hili si picha."));
      img.onload = () => {
        const side = 256;
        const scale = Math.min(1, side / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        let url = canvas.toDataURL("image/jpeg", 0.85);
        if (url.length > 180_000) url = canvas.toDataURL("image/jpeg", 0.6);
        resolve(url);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
