"use client";

import type React from "react";
import "./dashboardSidebar.css";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRightLeft,
  Bell,
  Bot,
  Calendar,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Cpu,
  CreditCard,
  FileText,
  FolderCog,
  FlaskConical,
  Gauge,
  Home,
  Image,
  Landmark,
  Layers,
  LayoutDashboard,
  Link2,
  LogOut,
  Radio,
  Repeat,
  Search,
  Send,
  Settings,
  Shield,
  Store,
  Upload,
  User,
  Users,
  Video,
  Wallet,
  Wand2,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserProjects } from "@/hooks/useUserProjects";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

type SubMenuItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
};

type MenuItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  subItems?: SubMenuItem[];
};

type MenuSection = {
  title?: string;
  items: MenuItem[];
  collapsible?: boolean;
  defaultOpen?: boolean;
};

type Props = {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
};

export function DashboardSidebar({ collapsed, setCollapsed }: Props) {
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openProjects, setOpenProjects] = useState<Record<string, boolean>>({});
  const [profileOpen, setProfileOpen] = useState(false);
  const { isOwner, isAdmin, isUser } = useUserRole();
  const { userProjects } = useUserProjects();
  const { profile, userId } = useAuth();

  // Use profile from centralized hook
  const userProfile = useMemo(() => 
    profile ? { full_name: profile.full_name, phone_number: profile.phone_number } : null,
    [profile]
  );

  // Load connected exchanges with react-query
  const { data: exchanges = [] } = useQuery({
    queryKey: ["exchanges", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("exchange_keys")
        .select("exchange")
        .eq("user_id", userId);
      if (data) {
        return Array.from(new Set(data.map(item => item.exchange)))
          .map(exchange => ({ exchange }));
      }
      return [];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  // Load pending demos count with react-query
  const { data: pendingDemosCount = 0 } = useQuery({
    queryKey: ["pending-demos-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("demo_bookings")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending_approval");
      return count || 0;
    },
    enabled: isOwner,
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 2, // Refetch every 2 minutes instead of realtime
  });

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logged out successfully");
      navigate("/auth");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Error logging out");
    }
  };
  const toggleSection = (title: string) => {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const toggleProject = (projectId: string) => {
    setOpenProjects(prev => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const isItemActive = (href?: string, isSubItem = false) => {
    if (!href) return false;
    if (href === pathname) return true;
    // For sub-items, use exact match only to avoid multiple highlights
    if (isSubItem) return false;
    // For parent items without sub-items, allow prefix match
    if (href !== "/" && pathname.startsWith(href)) return true;
    return false;
  };

  // Build menu sections
  const menuSections: MenuSection[] = [];

  // No top-level items needed anymore

  // Admin section - only for owner
  if (isOwner) {
    menuSections.push({
      title: "Admin",
      collapsible: false,
      items: [
        { id: "admin-dashboard", label: "Dashboard", icon: Home, href: "/admin/dashboard" },
        { id: "admin-clients", label: "Clients", icon: Users, href: "/admin/clients" },
        {
          id: "admin-finance", 
          label: "Finance", 
          icon: Landmark,
          subItems: [
            { id: "finance-dashboard", label: "Dashboard", icon: Home, href: "/admin/finance" },
            { id: "finance-transactions", label: "Transactions", icon: ArrowRightLeft, href: "/admin/finance/transactions" },
            { id: "finance-transfers", label: "Transfers", icon: Repeat, href: "/admin/finance/transfers" },
            { id: "finance-payments", label: "Payments", icon: Send, href: "/admin/finance/payments" },
          ]
        },
        { id: "admin-projects", label: "Project Management", icon: FolderCog, href: "/admin/projects" },
        { id: "admin-demo-calendar", label: "Demo Calendar", icon: Calendar, href: "/admin/demo-calendar" },
      ],
    });

    // Projects section with submenus
    menuSections.push({
      title: "Projects",
      collapsible: false,
      items: [
        { 
          id: "ai-social", 
          label: "Ai Social", 
          icon: CircleDollarSign,
          subItems: [
            { id: "ai-social-dashboard", label: "Dashboard", icon: Home, href: "/ai-social" },
            { id: "ai-social-generate", label: "Generate Image", icon: Image, href: "/ai-social/generate-image" },
            { id: "ai-social-video", label: "Generate Video", icon: Video, href: "/ai-social/generate-video" },
            { id: "ai-social-workflows", label: "Workflows", icon: Workflow, href: "/ai-social/workflows" },
            { id: "ai-social-schedule", label: "Schedule", icon: Calendar, href: "/ai-social/schedule" },
            { id: "ai-social-connections", label: "Connections", icon: Link2, href: "/ai-social/connections" },
            { id: "ai-social-live", label: "Live Studio", icon: Radio, href: "/ai-social/live-studio" },
          ]
        },
        { 
          id: "ai-art", 
          label: "AI Art", 
          icon: Wand2,
          subItems: [
            { id: "ai-art-image", label: "Generate Image", icon: Image, href: "/ai-art/generate-image" },
            { id: "ai-art-video", label: "Generate Video", icon: Video, href: "/ai-art/generate-video" },
          ]
        },
      ],
    });
  }

  // User projects (for non-admin users) - with same submenus
  if (!isOwner && !isAdmin && userProjects.length > 0) {
    const projectItems: MenuItem[] = userProjects.map((up) => {
      if (up.project.route === '/ai-social') {
        return { 
          id: `project-${up.project_id}`, 
          label: up.project.name, 
          icon: CircleDollarSign,
          subItems: [
            { id: "user-ai-social-dashboard", label: "Dashboard", icon: Home, href: "/ai-social" },
            { id: "user-ai-social-generate", label: "Generate Image", icon: Image, href: "/ai-social/generate-image" },
            { id: "user-ai-social-video", label: "Generate Video", icon: Video, href: "/ai-social/generate-video" },
            { id: "user-ai-social-workflows", label: "Workflows", icon: Workflow, href: "/ai-social/workflows" },
            { id: "user-ai-social-schedule", label: "Schedule", icon: Calendar, href: "/ai-social/schedule" },
            { id: "user-ai-social-connections", label: "Connections", icon: Link2, href: "/ai-social/connections" },
            { id: "user-ai-social-live", label: "Live Studio", icon: Radio, href: "/ai-social/live-studio" },
          ]
        };
      } else if (up.project.route === '/ai-art') {
        return { 
          id: `project-${up.project_id}`, 
          label: up.project.name, 
          icon: Wand2,
          subItems: [
            { id: "user-ai-art-image", label: "Generate Image", icon: Image, href: "/ai-art/generate-image" },
            { id: "user-ai-art-video", label: "Generate Video", icon: Video, href: "/ai-art/generate-video" },
          ]
        };
      }
      return { id: `project-${up.project_id}`, label: up.project.name, icon: LayoutDashboard, href: up.project.route };
    });

    if (projectItems.length > 0) {
      menuSections.push({
        title: "My Projects",
        collapsible: true,
        defaultOpen: true,
        items: projectItems,
      });
    }
  }

  // AI Agents section - only for owner
  if (isOwner) {
    menuSections.push({
      title: "AI Agents",
      collapsible: false,
      items: [
        { id: "agents-overview", label: "Overview", icon: Gauge, href: "/ai-agents" },
        { 
          id: "agents-core", 
          label: "Core Agents", 
          icon: Cpu,
          subItems: [
            { id: "agent-brain", label: "BRAIN", icon: Bot, href: "/ai-agents/brain" },
            { id: "agent-switch", label: "SWITCH", icon: ArrowRightLeft, href: "/ai-agents/switch" },
            { id: "agent-hlo", label: "HLO", icon: Users, href: "/ai-agents/hlo" },
          ]
        },
        { 
          id: "agents-business", 
          label: "Business Agents", 
          icon: CreditCard,
          subItems: [
            { id: "agent-intake", label: "INTAKE", icon: FileText, href: "/ai-agents/intake" },
            { id: "agent-quote", label: "QUOTE", icon: FileText, href: "/ai-agents/quote" },
            { id: "agent-deck", label: "DECK", icon: Layers, href: "/ai-agents/deck" },
            { id: "agent-call", label: "CALL", icon: Zap, href: "/ai-agents/call" },
          ]
        },
        { 
          id: "agents-social", 
          label: "Social Agents", 
          icon: Send,
          subItems: [
            { id: "agent-social-brain", label: "SOCIAL.BRAIN", icon: Bot, href: "/ai-agents/social-brain" },
            { id: "agent-social-publisher", label: "SOCIAL.PUBLISHER", icon: Send, href: "/ai-agents/social-publisher" },
            { id: "agent-social-reply", label: "SOCIAL.REPLY", icon: Zap, href: "/ai-agents/social-reply" },
          ]
        },
      ],
    });
  }

  // Tools section
  menuSections.push({
    title: "Tools",
    collapsible: false,
    items: [
      ...(isOwner ? [{ id: "audit-logs", label: "Audit Logs", icon: Shield, href: "/admin/audit-logs" }] : []),
      { id: "upload", label: "Upload", icon: Upload, href: "/file-upload" },
      { id: "labs", label: "Labs", icon: FlaskConical, href: "/labs" },
    ],
  });

  const renderMenuItem = (item: MenuItem) => {
    const Icon = item.icon;
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isActive = hasSubItems 
      ? item.subItems?.some(sub => isItemActive(sub.href))
      : isItemActive(item.href);
    const isProjectOpen = openProjects[item.id] ?? isActive ?? false;

    if (hasSubItems) {
      return (
        <div key={item.id}>
          <div
            className={cn(
              "flex items-center gap-3 px-3 py-2 text-[15px] transition-all duration-150 rounded-lg w-full",
              isActive
                ? "text-white"
                : "text-white/85 hover:bg-white/10"
            )}
          >
            <Icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
            <span className="font-normal flex-1 text-left">{item.label}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleProject(item.id);
              }}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              <ChevronRight
                className={cn(
                  "h-4 w-4 text-white/50 transition-transform duration-200",
                  isProjectOpen && "rotate-90"
                )}
              />
            </button>
          </div>
          {isProjectOpen && (
            <div className="ml-4 mt-0.5 space-y-0.5">
              {item.subItems?.map((subItem) => {
                const SubIcon = subItem.icon;
                const isSubActive = isItemActive(subItem.href, true);
                return (
                  <Link
                    key={subItem.id}
                    to={subItem.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-1.5 text-[14px] transition-all duration-150 rounded-lg",
                      isSubActive
                        ? "bg-white/15 backdrop-blur-md border border-white/20 text-white shadow-lg shadow-white/5"
                        : "text-white/70 hover:bg-white/10"
                    )}
                  >
                    <SubIcon className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                    <span className="font-normal">{subItem.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.id}
        to={item.href || "#"}
        className={cn(
          "flex items-center gap-3 px-3 py-2 text-[15px] transition-all duration-150 rounded-lg",
          isActive
            ? "bg-white/15 backdrop-blur-md border border-white/20 text-white shadow-lg shadow-white/5"
            : "text-white/85 hover:bg-white/10"
        )}
      >
        <Icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
        <span className="font-normal flex-1">{item.label}</span>
        {item.id === "admin-demo-calendar" && pendingDemosCount > 0 && (
          <Badge className="bg-red-500/80 text-white text-xs px-1.5 py-0 h-5 min-w-5 flex items-center justify-center">
            {pendingDemosCount}
          </Badge>
        )}
      </Link>
    );
  };

  const renderSection = (section: MenuSection, index: number) => {
    const isOpen = section.title ? (openSections[section.title] ?? section.defaultOpen ?? true) : true;

    return (
      <div key={index} className="mb-1">
        {section.title && (
          <button
            onClick={() => section.collapsible && toggleSection(section.title!)}
            className="flex items-center justify-between w-full px-3 py-1.5 text-white/40 hover:text-white/60 transition-colors"
          >
            <span className="text-[13px] font-normal">{section.title}</span>
            {section.collapsible && (
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  !isOpen && "-rotate-90"
                )}
              />
            )}
          </button>
        )}
        {isOpen && (
          <div className="space-y-0.5">
            {section.items.map(renderMenuItem)}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="space-sidebar fixed left-4 top-4 bottom-4 w-[260px] rounded-2xl flex flex-col z-50">
      
      {/* Search Row */}
      <div className="px-2 pt-4 pb-2">
        <Link
          to="/search"
          className={cn(
            "flex items-center gap-3 px-3 py-2 text-[15px] transition-all duration-150 rounded-lg",
            isItemActive("/search")
              ? "bg-white/15 backdrop-blur-md border border-white/20 text-white shadow-lg shadow-white/5"
              : "text-white/85 hover:bg-white/10"
          )}
        >
          <Search className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
          <span className="font-normal">Search</span>
        </Link>
        
        {/* Divider */}
        <div className="h-px bg-white/10 mt-3" />
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto px-2 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none]">
        {menuSections.map((section, idx) => renderSection(section, idx))}
      </nav>

      {/* User Profile - Collapsible */}
      <div className="p-3 border-t border-white/10">
        <button 
          onClick={() => setProfileOpen(!profileOpen)}
          className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/10 transition-all duration-200 w-full text-left"
        >
          <Avatar className="h-9 w-9">
            <AvatarImage src="" />
            <AvatarFallback className="bg-gradient-to-br from-yellow-400 to-orange-500 text-white text-sm font-medium">
              {userProfile?.full_name?.[0] || userProfile?.phone_number?.[0] || "U"}
            </AvatarFallback>
          </Avatar>
          <span className="text-[14px] text-white/90 font-normal flex-1 truncate">
            {userProfile?.full_name || userProfile?.phone_number || "User"}
          </span>
          <ChevronDown className={cn(
            "h-4 w-4 text-white/50 transition-transform duration-200",
            profileOpen && "rotate-180"
          )} />
        </button>
        
        {/* Collapsible Content */}
        <div className={cn(
          "overflow-hidden transition-all duration-200 ease-out",
          profileOpen ? "max-h-48 opacity-100 mt-2" : "max-h-0 opacity-0"
        )}>
          <div className="space-y-1 pl-2">
            <Link
              to="/settings?tab=profile"
              className="flex items-center gap-3 px-3 py-2 text-[14px] text-white/70 hover:text-white/90 hover:bg-white/10 rounded-lg transition-all"
            >
              <User className="h-4 w-4" />
              Profile
            </Link>
            {isOwner && (
              <Link
                to="/settings?tab=security"
                className="flex items-center gap-3 px-3 py-2 text-[14px] text-white/70 hover:text-white/90 hover:bg-white/10 rounded-lg transition-all"
              >
                <Zap className="h-4 w-4" />
                AI Model API
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 text-[14px] text-red-400 hover:text-red-300 hover:bg-white/10 rounded-lg transition-all w-full text-left"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
