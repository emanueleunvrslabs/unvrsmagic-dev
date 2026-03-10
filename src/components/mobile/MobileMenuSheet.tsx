"use client";

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ChevronRight, LogOut, Settings, User, Briefcase, Bot, Image, Zap, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNativeFeatures } from '@/hooks/use-native-features';
import { supabase } from '@/integrations/supabase/client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

interface MobileMenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  badge?: string;
}

const projectItems: MenuItem[] = [
  { icon: Bot, label: 'AI Social', path: '/ai-social/dashboard' },
  { icon: Image, label: 'AI Art', path: '/ai-art/generate-image' },
];

const settingsItems: MenuItem[] = [
  { icon: User, label: 'Profile', path: '/settings?tab=profile' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export function MobileMenuSheet({ open, onOpenChange }: MobileMenuSheetProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { hapticImpact } = useNativeFeatures();

  const handleNavigate = async (path: string) => {
    await hapticImpact('light');
    navigate(path);
    onOpenChange(false);
  };

  const handleLogout = async () => {
    await hapticImpact('medium');
    await supabase.auth.signOut();
    navigate('/auth');
    onOpenChange(false);
  };

  const isActive = (path: string) => location.pathname.startsWith(path.split('?')[0]);

  const renderMenuItem = (item: MenuItem) => {
    const Icon = item.icon;
    const active = isActive(item.path);

    return (
      <button
        key={item.path}
        onClick={() => handleNavigate(item.path)}
        className={cn(
          "w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 active:scale-[0.98]",
          active 
            ? "bg-white/10 text-foreground" 
            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
        )}
      >
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5" />
          <span className="text-[15px] font-medium">{item.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {item.badge && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
              {item.badge}
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="rounded-t-[20px] border-t border-white/10 max-h-[85vh]"
        style={{
          background: 'rgba(20, 20, 22, 0.95)',
          backdropFilter: 'blur(40px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
        }}
      >
        <SheetHeader className="pb-2">
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
          <SheetTitle className="text-left text-lg font-semibold">Menu</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 pb-safe">
          {/* Projects Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Projects
            </h3>
            <div className="space-y-1">
              {projectItems.map(renderMenuItem)}
            </div>
          </div>

          <Separator className="bg-white/10" />

          {/* Settings Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Account
            </h3>
            <div className="space-y-1">
              {settingsItems.map(renderMenuItem)}
            </div>
          </div>

          <Separator className="bg-white/10" />

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-destructive hover:bg-destructive/10 transition-all duration-200 active:scale-[0.98]"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-[15px] font-medium">Logout</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
