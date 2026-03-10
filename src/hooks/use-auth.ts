import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthData {
  user: User | null;
  profile: {
    username: string | null;
    full_name: string | null;
    phone_number: string;
    ref_code: string | null;
  } | null;
}

export const useAuth = () => {
  const queryClient = useQueryClient();

  // Invalida la cache auth ogni volta che Supabase cambia stato (login/logout)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "SIGNED_OUT") {
        queryClient.invalidateQueries({ queryKey: ["auth-user"] });
        queryClient.invalidateQueries({ queryKey: ["user-role"] });
      }
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  const { data, isLoading } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async (): Promise<AuthData> => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { user: null, profile: null };
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("username, full_name, phone_number, ref_code")
        .eq("user_id", user.id)
        .single();

      return { user, profile };
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  return {
    user: data?.user ?? null,
    profile: data?.profile ?? null,
    isLoading,
    userId: data?.user?.id ?? null,
  };
};
