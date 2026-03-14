import { DashboardLayout } from "@/components/dashboard-layout";
import "@/components/labs/SocialMediaCard.css";
import { Button } from "@/components/ui/button";
import { Unlink, Plus, Instagram, Linkedin, Youtube, Facebook, ExternalLink } from "lucide-react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { OAuthResponse, FunctionsInvokeError } from "@/types/edge-functions";

interface ConnectedAccount {
  id: string;
  provider: string;
  label: string | null;
  owner_id: string | null;
  created_at: string;
}

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.69a8.28 8.28 0 0 0 4.76 1.5V6.73a4.83 4.83 0 0 1-1-.04z"/>
  </svg>
);

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-5 w-5 text-white" />,
  linkedin: <Linkedin className="h-5 w-5 text-white" />,
  youtube: <Youtube className="h-5 w-5 text-white" />,
  facebook: <Facebook className="h-5 w-5 text-white" />,
  tiktok: <TikTokIcon />,
};

type PlatformConfig = {
  id: string;
  name: string;
  color: string;
  oauthFn: string | null;
  autoConnected?: boolean; // connected automatically via another platform
  comingSoon?: boolean;
};

const PLATFORMS: PlatformConfig[] = [
  { id: "instagram", name: "Instagram", color: "from-purple-500 to-pink-500", oauthFn: "instagram-oauth" },
  { id: "facebook", name: "Facebook", color: "from-blue-700 to-blue-500", oauthFn: null, autoConnected: true },
  { id: "linkedin", name: "LinkedIn", color: "from-blue-600 to-blue-400", oauthFn: "linkedin-oauth" },
  { id: "youtube", name: "YouTube", color: "from-red-600 to-red-400", oauthFn: "youtube-oauth" },
  { id: "tiktok", name: "TikTok", color: "from-gray-800 to-gray-600", oauthFn: null, comingSoon: true },
];

export default function Connection() {
  const queryClient = useQueryClient();

  const { data: connections, isLoading } = useQuery({
    queryKey: ['social-connections'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const { data, error } = await supabase
        .from('api_keys')
        .select('id, provider, label, owner_id, created_at')
        .eq('user_id', session.user.id)
        .in('provider', ['instagram', 'linkedin', 'youtube', 'facebook', 'tiktok'])
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as ConnectedAccount[];
    },
  });

  const connectPlatform = async (provider: string, oauthFn: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in first");
        return;
      }

      const { data, error } = await supabase.functions.invoke(oauthFn, {
        body: {
          action: "start",
          user_id: session.user.id,
          origin: window.location.origin,
        },
      });

      if (error) {
        const funcError = error as FunctionsInvokeError;
        toast.error(funcError.message || `Failed to connect ${provider}`);
        return;
      }

      const oauthData = data as OAuthResponse | null;
      if (oauthData?.error) {
        toast.error(oauthData.error);
        return;
      }

      if (oauthData?.authUrl) {
        window.location.href = oauthData.authUrl;
      } else {
        toast.error("Invalid OAuth response");
      }
    } catch {
      toast.error(`Failed to connect ${provider}`);
    }
  };

  const disconnectAccount = async (accountId: string, provider: string) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', accountId);

      if (error) throw error;
      toast.success(`${provider} account disconnected`);
      queryClient.invalidateQueries({ queryKey: ['social-connections'] });
    } catch {
      toast.error("Failed to disconnect");
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get('success') === 'true') {
      const count = params.get('connected');
      toast.success(count ? `${count} account(s) connected!` : "Connected!", { duration: 5000 });
      queryClient.invalidateQueries({ queryKey: ['social-connections'] });
      window.history.replaceState({}, '', '/ai-social/connections');
    }
    if (params.get('youtube_success') === 'true') {
      const channel = params.get('channel');
      toast.success(`YouTube connected! Channel: ${channel || 'Connected'}`);
      queryClient.invalidateQueries({ queryKey: ['social-connections'] });
      window.history.replaceState({}, '', '/ai-social/connections');
    }
    if (params.get('linkedin_success') === 'true') {
      const name = params.get('name');
      toast.success(`LinkedIn connected! ${name || ''}`);
      queryClient.invalidateQueries({ queryKey: ['social-connections'] });
      window.history.replaceState({}, '', '/ai-social/connections');
    }
    const error = params.get('error');
    if (error) {
      const msg = decodeURIComponent(error);
      console.error('[Connection] OAuth error:', msg);
      toast.error(`Connection failed: ${msg}`, { duration: 10000 });
      window.history.replaceState({}, '', '/ai-social/connections');
    }
  }, [queryClient]);

  const getAccountsForPlatform = (platformId: string) =>
    connections?.filter(c => c.provider === platformId) || [];

  const totalConnected = connections?.length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold">Connections</h1>
          <p className="text-sm text-white/40 mt-1">
            {totalConnected} account{totalConnected !== 1 ? 's' : ''} connected
          </p>
        </div>

        <div className="grid gap-3">
          {PLATFORMS.map((platform) => {
            const accounts = getAccountsForPlatform(platform.id);
            const hasAccounts = accounts.length > 0;

            return (
              <div key={platform.id} className="labs-client-card rounded-2xl overflow-hidden">
                {/* Platform header */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${platform.color} flex items-center justify-center shrink-0`}>
                      {PLATFORM_ICONS[platform.id]}
                    </div>
                    <div>
                      <h3 className="text-white font-medium text-sm">{platform.name}</h3>
                      <p className="text-[11px] text-white/30">
                        {platform.comingSoon
                          ? "Coming soon"
                          : platform.autoConnected
                            ? hasAccounts
                              ? `${accounts.length} page${accounts.length === 1 ? '' : 's'} · auto-connected via Instagram`
                              : "Auto-connected when you link Instagram"
                            : hasAccounts
                              ? `${accounts.length} account${accounts.length === 1 ? '' : 's'}`
                              : "Not connected"}
                      </p>
                    </div>
                  </div>

                  {platform.oauthFn && (
                    <Button
                      size="sm"
                      variant={hasAccounts ? "outline" : "default"}
                      onClick={() => connectPlatform(platform.id, platform.oauthFn!)}
                      className={`gap-1.5 text-xs h-8 ${hasAccounts ? 'border-white/10 text-white/60 hover:text-white hover:border-white/20' : ''}`}
                    >
                      <Plus className="h-3 w-3" />
                      {hasAccounts ? "Add" : "Connect"}
                    </Button>
                  )}

                  {platform.comingSoon && (
                    <span className="text-[11px] text-white/20 px-3 py-1.5 rounded-lg border border-white/5">
                      Soon
                    </span>
                  )}
                </div>

                {/* Connected accounts list */}
                {hasAccounts && (
                  <div className="px-5 pb-4 space-y-1.5">
                    {accounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span className="text-sm text-white/80 truncate">
                            {account.label || `${platform.name} Account`}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => disconnectAccount(account.id, platform.name)}
                          className="text-white/20 hover:text-red-400 hover:bg-red-500/10 h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Unlink className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
