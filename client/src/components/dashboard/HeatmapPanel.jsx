import { useLanguage } from "../../context/LanguageContext";
function getIntensityClass(ratio) {
  if (ratio >= 0.85) {
    return 'bg-rose-50 border-rose-200';
  }
  if (ratio >= 0.6) {
    return 'bg-amber-50 border-amber-200';
  }
  if (ratio >= 0.35) {
    return 'bg-accent-50 border-accent-200';
  }
  return 'bg-white border-brand-100';
}
export function HeatmapPanel({
  locations
}) {
  const {
    t
  } = useLanguage();
  const maxCount = Math.max(...locations.map(item => item.count), 1);
  return <section className="surface-card p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">{t("visible.05d3b6e51e74")}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-brand-950">{t("visible.a34d0a3f76c3")}</h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-brand-600">{t("visible.6f9ef0ef4c0e")}</p>
      </div>

      {locations.length ? <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {locations.map(location => {
        const ratio = location.count / maxCount;
        return <article key={location.label} className={`rounded-[24px] border p-5 ${getIntensityClass(ratio)}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-brand-950">{location.label}</p>
                    <p className="mt-1 text-sm text-brand-600">
                      {location.highRiskCount}{t("visible.c5b4c3265c6f")}</p>
                  </div>
                  <div className="rounded-full bg-brand-950 px-3 py-2 text-sm font-semibold text-white">
                    {location.count}
                  </div>
                </div>
              </article>;
      })}
        </div> : <div className="mt-6 rounded-[24px] border border-brand-100 bg-brand-50 px-5 py-4 text-sm text-brand-700">{t("visible.044aa61740ad")}</div>}
    </section>;
}
