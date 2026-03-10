

# Remove Delibere ARERA, Memora, Telegram Scraper, and NKMT sections

## Summary
Remove all four features from the application: routes, sidebar navigation, mobile navigation, settings references, and page files.

## Changes

### 1. Routes - `src/App.tsx`
- Remove imports: `NKMTDashboard`, `NKMTExchange`, `MktData`, `DerivData`, `MacroData`, `SentimentScout`, `ChainAnalyst`, `MarketModeler`, `SignalMaker`, `RiskMgr`, `TradeExecutor`, `Reviewer`, `DelibereArera`, `Memora`, `MemoraSubmit`, `TelegramScraper`, `AiBot`
- Remove all `/nkmt/*` routes, `/delibere-arera`, `/memora`, `/m/:refCode`, `/telegram-scraper` routes
- Redirect removed routes to `HomeRedirect` for graceful fallback

### 2. Sidebar - `src/components/dashboard-sidebar-topbar/dashboardSidebar.tsx`
- Remove from owner Projects section (lines 239-260): delibere-arera, memora, telegram-scraper, nkmt entries
- Remove from user projects section (lines 293-317): delibere-arera, memora, nkmt conditional branches
- Remove unused icon imports: `Cake`, `MessageCircle`, `Layers`, `Database`, `Activity`, `PieChart`

### 3. Mobile menu - `src/components/mobile/MobileMenuSheet.tsx`
- Remove NKMT Dashboard entry from `projectItems` (line 28)

### 4. Mobile header - `src/components/mobile/MobileHeader.tsx`
- Remove `/nkmt-dashboard` title mapping

### 5. Settings Security tab - `src/components/settings-interface/components/security/security-tab.tsx`
- Remove `NKMTAgentsSection` import and its `SettingsSection` block

### 6. Page files (keep but don't import - they become dead code)
The page files (`Memora.tsx`, `MemoraSubmit.tsx`, `TelegramScraper.tsx`, `DelibereArera.tsx`, `NKMTDashboard.tsx`, `MktData.tsx`, etc.) and their components will become unreachable dead code. They can be deleted in a follow-up cleanup.

