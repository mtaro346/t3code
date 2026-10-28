import { useClientSettings } from "./hooks/useSettings";

const english = (en: string, _ja: string) => en;
const japanese = (_en: string, ja: string) => ja;

export function useTranslate() {
  const language = useClientSettings((settings) => settings.language);
  return language === "ja" ? japanese : english;
}
