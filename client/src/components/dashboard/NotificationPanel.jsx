import { useLanguage } from "../../context/LanguageContext";
const severityClasses = {
  info: 'border-trust-200 bg-trust-50 text-brand-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  critical: 'border-rose-200 bg-rose-50 text-rose-800'
};
export function NotificationPanel({
  notifications,
  unreadCount
}) {
  const {
    t
  } = useLanguage();
  return <section className="surface-card p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow">{t("visible.f62e9267d196")}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-brand-950">{t("visible.d0d230a8fdd7")}</h2>
        </div>
        <div className="rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-900">
          {unreadCount}{t("visible.2cc1c371db10")}</div>
      </div>

      <p className="mt-3 text-sm leading-6 text-brand-600">{t("visible.55461b2db5a5")}</p>

      {notifications.length ? <div className="mt-6 space-y-3">
          {notifications.map(notification => <article key={notification._id} className={`rounded-[24px] border px-4 py-4 ${severityClasses[notification.severity] ?? 'border-brand-100 bg-brand-50 text-brand-900'}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">{notification.title}</p>
                  <p className="mt-2 text-sm opacity-90">{notification.eventClass}</p>
                  {notification.resourceRef ? <p className="mt-2 text-xs uppercase tracking-[0.18em] opacity-80">{t("visible.8c803292ae8f")}{notification.resourceRef}
                    </p> : null}
                </div>
                {!notification.isRead ? <span className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]">{t("visible.18fdd549b2ed")}</span> : null}
              </div>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] opacity-75">
                {new Date(notification.createdAt).toLocaleString()}
              </p>
            </article>)}
        </div> : <div className="mt-6 rounded-[24px] border border-brand-100 bg-brand-50 px-5 py-4 text-sm text-brand-700">{t("visible.ca02c722b098")}</div>}
    </section>;
}
