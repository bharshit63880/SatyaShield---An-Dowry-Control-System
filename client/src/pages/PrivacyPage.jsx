import { AI_DISCLOSURE_VERSION, PRIVACY_NOTICE_VERSION } from '../config/privacy';
import { useLanguage } from '../context/LanguageContext';
export function PrivacyPage() {
  const {
    t
  } = useLanguage();
  return <div className="page-shell py-12" style={{
    maxWidth: 880
  }}>
      <p className="eyebrow">{t("visible.c385c3440806")}</p>
      <h1>{t("visible.2c24e7dca82b")}</h1>
      <p>{t("visible.7894f66b63eb")}</p>
      <h2>{t("visible.b975a3af4169")}</h2>
      <p>{t("visible.72c8d34990a9")}</p>
      <h2>{t("visible.2a2bbc0303af")}</h2>
      <p>{t("visible.a1f8473c1dbc")}</p>
      <h2>{t("visible.517822d1bcd6")}</h2>
      <p>{t("visible.a97dbe142b65")}</p>
      <h2>{t("visible.e7c27d75a0c5")}</h2>
      <p>{t("visible.119e6cccaefb")}</p>
      <h2>{t("visible.48d7f6f5166b")}</h2>
      <p>{t("visible.4a2a204d54de")}</p>
      <h2>{t("visible.4e9942e6d2fe")}</h2>
      <p>{t("visible.94040c478e96")}</p>
      <p>{t('privacy.help')}</p>
      <p>{t("visible.3a2540dde435")}{PRIVACY_NOTICE_VERSION}{t("visible.4127d4ec384e")}{AI_DISCLOSURE_VERSION}{t("visible.9b5c25d3f4a0")}</p>
    </div>;
}
