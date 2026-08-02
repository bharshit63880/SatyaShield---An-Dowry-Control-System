import { useLanguage } from "../../context/LanguageContext";
import { NavLink } from 'react-router-dom';
const primaryLinks = [{
  to: '/dashboard',
  labelKey: 'visible.34a9d3b1d94c'
}, {
  to: '/report',
  labelKey: 'visible.e84384dbcf77'
}];
const statusLabelKeys = {
  submitted: 'visible.64900440a8c9',
  'under-review': 'visible.115fe4ba8ea9',
  resolved: 'visible.5be3c2c8354e',
  rejected: 'visible.aea4a04a8042'
};
export function DashboardSidebar({
  statusSummary
}) {
  const {
    t
  } = useLanguage();
  return <aside className="rounded-[32px] border border-brand-100 bg-[linear-gradient(180deg,#10203f_0%,#132d58_55%,#17376b_100%)] p-5 text-white shadow-float">
      <div className="rounded-[26px] border border-white/10 bg-white/[0.05] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-trust-200">{t("visible.ddf870cabeb2")}</p>
        <h2 className="mt-3 text-2xl font-semibold">{t("visible.34a9d3b1d94c")}</h2>
        <p className="mt-3 text-sm leading-6 text-brand-100">{t("visible.65028fd07e5d")}</p>
      </div>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-200">{t("visible.5ea5fbe811db")}</p>
        <nav className="mt-3 space-y-2">
          {primaryLinks.map(item => <NavLink key={item.to} to={item.to} className={({
          isActive
        }) => `flex items-center justify-between rounded-[22px] px-4 py-3 text-sm font-medium transition ${isActive ? 'bg-white text-brand-950 shadow-[0_14px_34px_rgba(8,18,40,0.2)]' : 'bg-white/[0.05] text-white hover:bg-white/[0.1]'}`}>
              <span>{t(item.labelKey)}</span>
              <span className="text-xs uppercase tracking-[0.2em] opacity-80">{t("visible.ed077f3d8125")}</span>
            </NavLink>)}
        </nav>
      </div>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-200">{t("visible.0585df874561")}</p>
        <div className="mt-3 space-y-2">
          {Object.entries(statusLabelKeys).map(([key, labelKey]) => <div key={key} className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-brand-100">
              <span>{t(labelKey)}</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                {statusSummary?.[key] ?? 0}
              </span>
            </div>)}
        </div>
      </div>
    </aside>;
}
