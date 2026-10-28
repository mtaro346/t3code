import { useTranslate } from "../../i18n";
import { useRef } from "react";
import { BranchNamingMode, DEFAULT_SERVER_SETTINGS } from "@t3tools/contracts";

import { Input } from "../ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { SettingsRow, SettingResetButton } from "./settingsLayout";
import { useSettingsScope } from "./SettingsScopeContext";
import { searchableSetting } from "./settingsSearch";
import {
  useScopedSettings,
  useScopedSettingsMixed,
  useUpdateScopedSettings,
} from "./useScopedSettings";

export function BranchNamingSettings() {
  const t = useTranslate();
  const modes: Record<BranchNamingMode, string> = {
    static: t("Static prefix", "固定プレフィックス"),
    semantic: t("Semantic prefix", "内容に応じたプレフィックス"),
    custom: t("Custom instructions", "カスタム指示"),
  };
  const settings = useScopedSettings();
  const { targets } = useSettingsScope();
  const scopeKey = targets.map((target) => `${target.environmentId}:${target.projectId}`).join(",");
  const prefixEdited = useRef(false);
  const instructionsEdited = useRef(false);
  const updateSettings = useUpdateScopedSettings();
  const modeMixed = useScopedSettingsMixed(["branchNamingMode"]);
  const prefixMixed = useScopedSettingsMixed(["branchNamePrefix"]);
  const instructionsMixed = useScopedSettingsMixed(["branchNameInstructions"]);

  return (
    <>
      <SettingsRow
        serverScoped
        settingKeys={["branchNamingMode"]}
        {...searchableSetting("worktree-branch-naming")}
        title={t("Worktree branch naming", "ワークツリーのブランチ名")}
        description={t(
          "Choose how new worktree branches are named from your first message.",
          "最初のメッセージから新しいワークツリーのブランチ名を決める方法を選びます。",
        )}
        status={
          !modeMixed && settings.branchNamingMode === "semantic"
            ? t(
                "The model chooses a prefix that describes the work, such as feat/add-search, fix/login-timeout, or refactor/auth.",
                "モデルが作業内容に応じたプレフィックスを選びます。例: feat/add-search、fix/login-timeout、refactor/auth。",
              )
            : undefined
        }
        resetAction={
          settings.branchNamingMode !== DEFAULT_SERVER_SETTINGS.branchNamingMode || modeMixed ? (
            <SettingResetButton
              label="branch naming"
              onClick={() =>
                updateSettings({ branchNamingMode: DEFAULT_SERVER_SETTINGS.branchNamingMode })
              }
            />
          ) : null
        }
        control={
          <Select
            value={modeMixed ? null : settings.branchNamingMode}
            onValueChange={(value) => {
              if (BranchNamingMode.literals.includes(value as BranchNamingMode)) {
                updateSettings({ branchNamingMode: value as BranchNamingMode });
              }
            }}
          >
            <SelectTrigger
              size="sm"
              aria-label={t("Worktree branch naming", "ワークツリーのブランチ名")}
            >
              <SelectValue>
                {(value: BranchNamingMode | null) =>
                  value === null ? t("Mixed", "混在") : modes[value]
                }
              </SelectValue>
            </SelectTrigger>
            <SelectPopup align="end" alignItemWithTrigger={false}>
              {BranchNamingMode.literals.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {modes[mode]}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        }
      />
      {!modeMixed && settings.branchNamingMode === "static" ? (
        <SettingsRow
          serverScoped
          settingKeys={["branchNamePrefix"]}
          title={t("Branch prefix", "ブランチのプレフィックス")}
          description={t(
            "For example, t3 or t3/ produces t3/add-search. Leave empty for no prefix.",
            "例えば t3 または t3/ を指定すると t3/add-search になります。空欄の場合はプレフィックスを付けません。",
          )}
          resetAction={
            prefixMixed ||
            settings.branchNamePrefix !== DEFAULT_SERVER_SETTINGS.branchNamePrefix ? (
              <SettingResetButton
                label="branch prefix"
                onClick={() =>
                  updateSettings({ branchNamePrefix: DEFAULT_SERVER_SETTINGS.branchNamePrefix })
                }
              />
            ) : null
          }
          control={
            <Input
              key={`${scopeKey}:${prefixMixed}:${settings.branchNamePrefix}`}
              aria-label={t("Branch prefix", "ブランチのプレフィックス")}
              autoCapitalize="none"
              spellCheck={false}
              onChange={() => {
                prefixEdited.current = true;
              }}
              placeholder={prefixMixed ? t("Mixed", "混在") : t("No prefix", "プレフィックスなし")}
              defaultValue={prefixMixed ? "" : settings.branchNamePrefix}
              onBlur={(event) => {
                const value = event.target.value.trim();
                if (prefixEdited.current && (prefixMixed || value !== settings.branchNamePrefix))
                  updateSettings({ branchNamePrefix: value });
                prefixEdited.current = false;
              }}
            />
          }
        />
      ) : null}
      {!modeMixed && settings.branchNamingMode === "custom" ? (
        <SettingsRow
          serverScoped
          settingKeys={["branchNameInstructions"]}
          title={t("Branch naming instructions", "ブランチ名の指示")}
          description={t(
            "Appended to the naming prompt. The model returns the complete branch name; no prefix or suffix is added.",
            "命名用プロンプトに追加します。モデルが完全なブランチ名を返し、プレフィックスやサフィックスは追加されません。",
          )}
          resetAction={
            instructionsMixed || settings.branchNameInstructions !== "" ? (
              <SettingResetButton
                label="branch naming instructions"
                onClick={() => updateSettings({ branchNameInstructions: "" })}
              />
            ) : null
          }
        >
          <div className="mt-3 max-w-2xl pb-3.5">
            <Textarea
              key={`${scopeKey}:${instructionsMixed}:${settings.branchNameInstructions}`}
              aria-label={t("Branch naming instructions", "ブランチ名の指示")}
              onChange={() => {
                instructionsEdited.current = true;
              }}
              rows={4}
              defaultValue={instructionsMixed ? "" : settings.branchNameInstructions}
              placeholder={
                instructionsMixed
                  ? t(
                      "Mixed. Enter instructions to apply to all selected targets.",
                      "混在しています。選択したすべての対象に適用する指示を入力してください。",
                    )
                  : t(
                      "Use julius/ followed by the issue ID and a short description.",
                      "julius/ の後に issue ID と簡単な説明を続けてください。",
                    )
              }
              onBlur={(event) => {
                const value = event.target.value.trim();
                if (
                  instructionsEdited.current &&
                  (instructionsMixed || value !== settings.branchNameInstructions)
                )
                  updateSettings({ branchNameInstructions: value });
                instructionsEdited.current = false;
              }}
            />
          </div>
        </SettingsRow>
      ) : null}
    </>
  );
}
