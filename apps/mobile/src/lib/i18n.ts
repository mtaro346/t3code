import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { mobilePreferencesAtom } from "../state/preferences";

const english = (en: string, _ja: string) => en;
const japanese = (_en: string, ja: string) => ja;

export function useTranslate() {
  const preferences = useAtomValue(mobilePreferencesAtom);
  return AsyncResult.isSuccess(preferences) && preferences.value.language === "ja"
    ? japanese
    : english;
}

const settingsLabels: Readonly<Record<string, string>> = {
  Settings: "設定",
  Chats: "チャット",
  PRs: "プルリクエスト",
  Pulls: "プルリクエスト",
  Usage: "利用状況",
  Navigation: "ナビゲーション",
  "Search threads": "スレッドを検索",
  "Search pull requests": "プルリクエストを検索",
  "Search settings": "設定を検索",
  General: "一般",
  Appearance: "外観",
  Chat: "チャット",
  "Navigation tabs": "ナビゲーションタブ",
  Keyboard: "キーボード",
  Microphone: "マイク",
  Agents: "エージェント",
  Providers: "プロバイダー",
  Threads: "スレッド",
  "Scheduled tasks": "スケジュールされたタスク",
  Code: "コード",
  Projects: "プロジェクト",
  "Source control": "ソース管理",
  Worktrees: "ワークツリー",
  Maintenance: "メンテナンス",
  Labs: "実験的機能",
  About: "このアプリについて",
  Archive: "アーカイブ",
  Connections: "接続",
  Environments: "環境",
  Notifications: "通知",
  "T3 Account": "T3 アカウント",
};

export function translateSettingsLabel(t: (en: string, ja: string) => string, label: string) {
  return t(label, settingsLabels[label] ?? label);
}
