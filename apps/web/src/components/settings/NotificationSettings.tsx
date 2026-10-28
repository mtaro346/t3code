import { useTranslate } from "../../i18n";
import { settlePromise } from "@t3tools/client-runtime/state/runtime";
import { useState } from "react";

import {
  hasDesktopNotifications,
  hasNotificationSound,
  NOTIFICATION_MODE_LABELS,
  unlockNotificationAudio,
} from "../../threadNotifications";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import { useScopedSettings, useUpdateScopedSettings } from "./useScopedSettings";

export function NotificationSettings() {
  const t = useTranslate();
  const labels: Record<string, string> = {
    off: t("Off", "オフ"),
    notifications: t("Notifications only", "通知のみ"),
    sound: t("Sound only", "サウンドのみ"),
    "notifications-and-sound": t("Notifications with sound", "通知とサウンド"),
  };
  const mode = useScopedSettings((settings) => settings.notificationMode);
  const updateSettings = useUpdateScopedSettings();
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  return (
    <SettingsRow
      {...searchableSetting("thread-notifications")}
      title={t("Thread notifications", "スレッドの通知")}
      description={
        permissionMessage ??
        t(
          "System alerts when a thread finishes, fails, or needs input or approval. Applies to this device while T3 Code is open.",
          "スレッドの完了、失敗、入力や承認の要求を通知します。T3 Code を開いている間、この端末に適用されます。",
        )
      }
      control={
        <Select
          value={mode}
          disabled={requesting}
          onValueChange={async (value) => {
            if (
              value !== "off" &&
              value !== "notifications" &&
              value !== "sound" &&
              value !== "notifications-and-sound"
            )
              return;
            setPermissionMessage(null);
            if (hasNotificationSound(value)) unlockNotificationAudio();
            if (hasDesktopNotifications(value)) {
              if (typeof Notification === "undefined" || !window.isSecureContext) {
                setPermissionMessage(
                  t(
                    "Notifications need a supported browser over HTTPS, or the desktop app. Sound only is still available.",
                    "通知には HTTPS 対応のブラウザまたはデスクトップアプリが必要です。サウンドのみの設定は利用できます。",
                  ),
                );
                return;
              }
              setRequesting(true);
              const permission = await settlePromise(() => Notification.requestPermission());
              setRequesting(false);
              if (permission._tag === "Failure") {
                setPermissionMessage(
                  t(
                    "Notifications are unavailable in this browser. Sound only is still available.",
                    "このブラウザでは通知を利用できません。サウンドのみの設定は利用できます。",
                  ),
                );
                return;
              }
              if (permission.value !== "granted") {
                setPermissionMessage(
                  t(
                    "Allow notifications in your browser or system settings, then choose this option again. Sound only is still available.",
                    "ブラウザまたはシステムの設定で通知を許可してから、もう一度選択してください。サウンドのみの設定は利用できます。",
                  ),
                );
                return;
              }
            }
            updateSettings({ notificationMode: value });
          }}
        >
          <SelectTrigger
            size="sm"
            className="w-full sm:w-56"
            aria-label={t("Thread notifications", "スレッドの通知")}
          >
            <SelectValue>{labels[mode] ?? NOTIFICATION_MODE_LABELS[mode]}</SelectValue>
          </SelectTrigger>
          <SelectPopup align="end" alignItemWithTrigger={false}>
            {Object.entries(NOTIFICATION_MODE_LABELS).map(([value, label]) => (
              <SelectItem key={value} hideIndicator value={value}>
                {labels[value] ?? label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      }
    />
  );
}
