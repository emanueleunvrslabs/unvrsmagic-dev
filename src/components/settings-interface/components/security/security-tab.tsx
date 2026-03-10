"use client"

import type React from "react"
import { SettingsSection } from "../shared/settings-section"
import { SettingsToggle } from "../shared/settings-toggle"
import { ApiKeysSection } from "./api-keys-section"
import { AIAgentsSection } from "../ai-agents/ai-agents-section"
import { ActiveSessionsSection } from "./active-sessions-section"
import { LoginHistorySection } from "./login-history-section"
import type { SecuritySettings, ApiKey, Session, LoginHistory } from "../../types"

interface SecurityTabProps {
  security: SecuritySettings
  apiKeys: ApiKey[]
  sessions: Session[]
  loginHistory: LoginHistory[]
  onSecurityChange: (updates: Partial<SecuritySettings>) => void
  onApiKeysChange: (apiKeys: ApiKey[]) => void
  onSessionsChange: (sessions: Session[]) => void
}

export const SecurityTab: React.FC<SecurityTabProps> = ({
  security,
  apiKeys,
  sessions,
  loginHistory,
  onSecurityChange,
  onApiKeysChange,
  onSessionsChange,
}) => {
  return (
    <div className="space-y-6">
      <SettingsSection title="API Access" description="Manage API keys for programmatic access">
        <ApiKeysSection apiKeys={apiKeys} onApiKeysChange={onApiKeysChange} />
      </SettingsSection>

      <SettingsSection title="AI Agents" description="Connect and manage your AI agent providers">
        <AIAgentsSection apiKeys={apiKeys} onApiKeysChange={onApiKeysChange} />
      </SettingsSection>
    </div>
  )
}
