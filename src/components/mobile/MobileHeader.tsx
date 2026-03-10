"use client";

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Menu, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNativeFeatures } from '@/hooks/use-native-features';
import { Button } from '@/components/ui/button';

interface MobileHeaderProps {
  title?: string;
  showBack?: boolean;
  showMenu?: boolean;
  rightAction?: React.ReactNode;
  onMenuClick?: () => void;
  transparent?: boolean;
  large?: boolean;
}

export function MobileHeader({
  title,
  showBack = true,
  showMenu = false,
  rightAction,
  onMenuClick,
  transparent = false,
  large = false
}: MobileHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { hapticImpact } = useNativeFeatures();

  const canGoBack = location.key !== 'default';

  const handleBack = async () => {
    await hapticImpact('light');
    navigate(-1);
  };

  const handleMenu = async () => {
    await hapticImpact('light');
    onMenuClick?.();
  };

  // Map routes to titles
  const getTitle = () => {
    if (title) return title;
    const path = location.pathname;
    const titleMap: Record<string, string> = {
      '/': 'Home',
      '/marketplace': 'Marketplace',
      '/search': 'Search',
      '/wallet': 'Wallet',
      '/notifications': 'Notifications',
      '/settings': 'Settings',
      '/ai-social': 'AI Social',
      '/ai-art': 'AI Art',
    };
    return titleMap[path] || 'UNVRS Magic';
  };

  return (
    <header 
      className={cn(
        "fixed top-0 left-0 right-0 z-50 pt-safe",
        !transparent && "border-b border-white/10"
      )}
      style={!transparent ? {
        background: 'rgba(11, 11, 13, 0.85)',
        backdropFilter: 'blur(40px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
      } : {}}
    >
      <div className="flex items-center justify-between h-11 px-4">
        {/* Left side */}
        <div className="flex items-center gap-2 min-w-[60px]">
          {showBack && canGoBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="h-9 w-9 -ml-2 text-primary hover:bg-white/10"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}
          {showMenu && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleMenu}
              className="h-9 w-9 -ml-2 text-foreground hover:bg-white/10"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Center - Title */}
        {!large && (
          <h1 className="text-base font-semibold text-foreground truncate max-w-[200px]">
            {getTitle()}
          </h1>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2 min-w-[60px] justify-end">
          {rightAction || (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 -mr-2 text-foreground hover:bg-white/10 opacity-0 pointer-events-none"
            >
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Large title */}
      {large && (
        <div className="px-4 pb-2">
          <h1 className="text-[34px] font-bold tracking-tight text-foreground">
            {getTitle()}
          </h1>
        </div>
      )}
    </header>
  );
}
