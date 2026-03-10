"use client";

import React, { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import {
  MessageCircle,
  Users,
  Image,
  Terminal,
  Send,
  RefreshCw,
  Bot,
  ExternalLink,
  Phone,
  Mail,
  Building,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  Zap,
  AlertCircle,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Conversation = {
  id: string;
  channel: string;
  contact_identifier: string;
  contact_name: string | null;
  current_agent: string | null;
  status: string;
  last_message_at: string | null;
  created_at: string;
};

type Message = {
  id: string;
  conversation_id: string;
  content: string | null;
  direction: string;
  content_type: string;
  media_url: string | null;
  created_at: string;
  processed_by_agent: string | null;
};

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  source_channel: string | null;
  notes: string | null;
  created_at: string;
  first_contact_at: string | null;
};

type AiContent = {
  id: string;
  title: string;
  type: string;
  status: string;
  prompt: string;
  media_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
  metadata: any;
};

// ─── Helper Components ─────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { color: string; label: string }> = {
    active: { color: "bg-green-500/20 text-green-400 border-green-500/30", label: "Attivo" },
    closed: { color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30", label: "Chiuso" },
    pending: { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", label: "In attesa" },
    new: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Nuovo" },
    qualified: { color: "bg-purple-500/20 text-purple-400 border-purple-500/30", label: "Qualificato" },
    converted: { color: "bg-green-500/20 text-green-400 border-green-500/30", label: "Convertito" },
    completed: { color: "bg-green-500/20 text-green-400 border-green-500/30", label: "Completato" },
    processing: { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", label: "Processing" },
    failed: { color: "bg-red-500/20 text-red-400 border-red-500/30", label: "Fallito" },
  };
  const s = map[status] ?? { color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30", label: status };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${s.color}`}>
      {s.label}
    </span>
  );
};

const ChannelIcon = ({ channel }: { channel: string }) => {
  if (channel === "telegram") return <span className="text-blue-400 text-xs font-medium">TG</span>;
  if (channel === "whatsapp") return <span className="text-green-400 text-xs font-medium">WA</span>;
  return <span className="text-zinc-400 text-xs font-medium">{channel?.toUpperCase()?.slice(0, 2)}</span>;
};

// ─── Chat Tab ─────────────────────────────────────────────────────────────────

const ChatTab = ({ userId }: { userId: string }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["openclaw-conversations", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("unvrs_conversations")
        .select("*")
        .eq("user_id", userId)
        .order("last_message_at", { ascending: false });
      return (data ?? []) as Conversation[];
    },
    refetchInterval: 10000,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["openclaw-messages", selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const { data } = await supabase
        .from("unvrs_messages")
        .select("*")
        .eq("conversation_id", selectedId)
        .order("created_at", { ascending: true });
      return (data ?? []) as Message[];
    },
    enabled: !!selectedId,
    refetchInterval: 5000,
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("openclaw-messages-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "unvrs_messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["openclaw-messages", selectedId] });
        queryClient.invalidateQueries({ queryKey: ["openclaw-conversations", userId] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "unvrs_conversations" }, () => {
        queryClient.invalidateQueries({ queryKey: ["openclaw-conversations", userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedId, userId, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selected = conversations.find((c) => c.id === selectedId);

  return (
    <div className="flex h-[calc(100vh-220px)] gap-4">
      {/* Conversation list */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-1 overflow-y-auto pr-1">
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-5 w-5 animate-spin text-white/40" />
          </div>
        )}
        {!isLoading && conversations.length === 0 && (
          <div className="text-center text-white/40 text-sm py-12">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Nessuna conversazione</p>
            <p className="text-xs mt-1 opacity-60">I messaggi dal bot appariranno qui</p>
          </div>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => setSelectedId(conv.id)}
            className={`w-full text-left p-3 rounded-xl transition-all duration-150 ${
              selectedId === conv.id
                ? "bg-white/15 border border-white/20"
                : "hover:bg-white/8 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                <ChannelIcon channel={conv.channel} />
              </div>
              <span className="text-sm text-white font-medium truncate flex-1">
                {conv.contact_name || conv.contact_identifier}
              </span>
              <StatusBadge status={conv.status} />
            </div>
            {conv.last_message_at && (
              <p className="text-xs text-white/40 pl-9">
                {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: it })}
              </p>
            )}
            {conv.current_agent && (
              <p className="text-xs text-white/30 pl-9 truncate">
                <Bot className="h-3 w-3 inline mr-1" />{conv.current_agent}
              </p>
            )}
          </button>
        ))}
      </div>

      {/* Messages pane */}
      <div className="flex-1 flex flex-col rounded-xl border border-white/10 bg-white/3 overflow-hidden">
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center text-white/30">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Seleziona una conversazione</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <ChannelIcon channel={selected?.channel ?? ""} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">
                  {selected?.contact_name || selected?.contact_identifier}
                </p>
                <p className="text-xs text-white/40">{selected?.channel} · {selected?.contact_identifier}</p>
              </div>
              <StatusBadge status={selected?.status ?? ""} />
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.direction === "outbound"
                        ? "bg-white/15 text-white rounded-br-sm"
                        : "bg-white/8 text-white/85 rounded-bl-sm"
                    }`}
                  >
                    {msg.media_url && msg.content_type === "image" && (
                      <img src={msg.media_url} alt="media" className="rounded-lg mb-2 max-w-full" />
                    )}
                    {msg.content && <p className="leading-relaxed">{msg.content}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs opacity-40">
                        {format(new Date(msg.created_at), "HH:mm")}
                      </span>
                      {msg.processed_by_agent && (
                        <span className="text-xs opacity-30">
                          <Bot className="h-3 w-3 inline mr-0.5" />{msg.processed_by_agent}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Leads Tab ────────────────────────────────────────────────────────────────

const LeadsTab = ({ userId }: { userId: string }) => {
  const [filter, setFilter] = useState<string>("all");

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ["openclaw-leads", userId, filter],
    queryFn: async () => {
      let query = supabase
        .from("unvrs_leads")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (filter !== "all") query = query.eq("status", filter);
      const { data } = await query;
      return (data ?? []) as Lead[];
    },
  });

  const stats = {
    new: leads.filter((l) => l.status === "new").length,
    qualified: leads.filter((l) => l.status === "qualified").length,
    converted: leads.filter((l) => l.status === "converted").length,
    total: leads.length,
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Totali", value: stats.total, icon: Users, color: "text-white/70" },
          { label: "Nuovi", value: stats.new, icon: AlertCircle, color: "text-blue-400" },
          { label: "Qualificati", value: stats.qualified, icon: CheckCircle, color: "text-purple-400" },
          { label: "Convertiti", value: stats.converted, icon: ArrowUpRight, color: "text-green-400" },
        ].map((s) => (
          <Card key={s.label} className="bg-white/5 border-white/10">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <div>
                <p className="text-2xl font-semibold text-white">{s.value}</p>
                <p className="text-xs text-white/50">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + Refresh */}
      <div className="flex items-center gap-2">
        {["all", "new", "qualified", "converted"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
              filter === f ? "bg-white/15 text-white border border-white/20" : "text-white/50 hover:text-white/80"
            }`}
          >
            {f === "all" ? "Tutti" : f === "new" ? "Nuovi" : f === "qualified" ? "Qualificati" : "Convertiti"}
          </button>
        ))}
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-white/50 hover:text-white">
            <RefreshCw className="h-4 w-4 mr-1" /> Aggiorna
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-left px-4 py-3 text-white/50 font-medium">Nome</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium">Contatto</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium">Azienda</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium">Fonte</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium">Stato</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-white/30 mx-auto" />
                </td>
              </tr>
            )}
            {!isLoading && leads.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-white/30">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Nessun lead trovato</p>
                  <p className="text-xs mt-1 opacity-60">Chiedi al bot di fare scraping per trovare leads</p>
                </td>
              </tr>
            )}
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3">
                  <span className="text-white font-medium">{lead.name || "—"}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-0.5">
                    {lead.email && (
                      <div className="flex items-center gap-1 text-white/60">
                        <Mail className="h-3 w-3" /> <span className="text-xs">{lead.email}</span>
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-1 text-white/60">
                        <Phone className="h-3 w-3" /> <span className="text-xs">{lead.phone}</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {lead.company ? (
                    <div className="flex items-center gap-1 text-white/70">
                      <Building className="h-3 w-3" /> <span>{lead.company}</span>
                    </div>
                  ) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="text-white/50 text-xs">{lead.source_channel || "—"}</span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-4 py-3 text-white/40 text-xs">
                  {format(new Date(lead.created_at), "dd/MM/yy HH:mm")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Images Tab ───────────────────────────────────────────────────────────────

const ImagesTab = ({ userId }: { userId: string }) => {
  const [selected, setSelected] = useState<AiContent | null>(null);

  const { data: images = [], isLoading, refetch } = useQuery({
    queryKey: ["openclaw-images", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_social_content")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      return (data ?? []) as AiContent[];
    },
    refetchInterval: 15000,
  });

  const completed = images.filter((i) => i.status === "completed");
  const processing = images.filter((i) => i.status === "processing");

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex items-center gap-4">
        <div className="text-sm text-white/50">
          <span className="text-white font-semibold">{completed.length}</span> completate
        </div>
        {processing.length > 0 && (
          <div className="flex items-center gap-1.5 text-yellow-400 text-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {processing.length} in elaborazione
          </div>
        )}
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-white/50 hover:text-white">
            <RefreshCw className="h-4 w-4 mr-1" /> Aggiorna
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-white/30" />
        </div>
      )}

      {!isLoading && images.length === 0 && (
        <div className="text-center py-16 text-white/30">
          <Image className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Nessuna immagine generata</p>
          <p className="text-xs mt-1 opacity-60">Chiedi al bot di generare un'immagine per vederla qui</p>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {images.map((img) => (
          <div
            key={img.id}
            className="group relative rounded-xl overflow-hidden border border-white/10 bg-white/5 cursor-pointer aspect-square"
            onClick={() => setSelected(img)}
          >
            {img.status === "completed" && img.media_url ? (
              <img
                src={img.thumbnail_url ?? img.media_url}
                alt={img.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : img.status === "processing" ? (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
              </div>
            ) : img.status === "failed" ? (
              <div className="w-full h-full flex items-center justify-center">
                <XCircle className="h-6 w-6 text-red-400" />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Clock className="h-6 w-6 text-white/20" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
              <p className="text-white text-xs font-medium truncate">{img.title}</p>
              <p className="text-white/50 text-xs">{format(new Date(img.created_at), "dd/MM HH:mm")}</p>
            </div>
            <div className="absolute top-2 right-2">
              <StatusBadge status={img.status} />
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-[#1a1a2e] border border-white/10 rounded-2xl max-w-2xl w-full p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-white font-semibold">{selected.title}</h3>
                <p className="text-white/40 text-xs mt-0.5">{format(new Date(selected.created_at), "dd/MM/yyyy HH:mm")}</p>
              </div>
              <StatusBadge status={selected.status} />
            </div>
            {selected.media_url && (
              <img src={selected.media_url} alt={selected.title} className="w-full rounded-xl" />
            )}
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-xs text-white/50 mb-1">Prompt</p>
              <p className="text-sm text-white/80 leading-relaxed">{selected.prompt}</p>
            </div>
            {selected.media_url && (
              <a
                href={selected.media_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
              >
                <ExternalLink className="h-4 w-4" /> Apri originale
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Bot Control Tab ──────────────────────────────────────────────────────────

const BotControlTab = ({ userId }: { userId: string }) => {
  const [command, setCommand] = useState("");
  const [log, setLog] = useState<{ ts: string; msg: string; type: "in" | "out" | "err" }[]>([]);
  const [sending, setSending] = useState(false);
  const queryClient = useQueryClient();

  const { data: recentLogs = [] } = useQuery({
    queryKey: ["openclaw-bot-logs", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_logs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    refetchInterval: 10000,
  });

  const sendCommand = async () => {
    if (!command.trim() || sending) return;
    const cmd = command.trim();
    setCommand("");
    setSending(true);
    setLog((prev) => [...prev, { ts: new Date().toLocaleTimeString(), msg: `> ${cmd}`, type: "out" }]);

    try {
      // Insert as agent_message to trigger OpenClaw
      const { error } = await supabase.from("agent_messages").insert({
        sender_agent: "dashboard",
        receiver_agent: "UNVRS.BRAIN",
        message_type: "command",
        payload: { command: cmd, source: "openclaw-dashboard" },
        user_id: userId,
      });

      if (error) throw error;
      setLog((prev) => [...prev, { ts: new Date().toLocaleTimeString(), msg: "Comando inviato a UNVRS.BRAIN", type: "in" }]);
      queryClient.invalidateQueries({ queryKey: ["openclaw-bot-logs", userId] });
    } catch (err: any) {
      setLog((prev) => [...prev, { ts: new Date().toLocaleTimeString(), msg: `Errore: ${err.message}`, type: "err" }]);
    } finally {
      setSending(false);
    }
  };

  const quickCommands = [
    { label: "Status bot", cmd: "status check" },
    { label: "Lista cron", cmd: "list cron jobs" },
    { label: "Ultimi leads", cmd: "show recent leads" },
    { label: "Test Telegram", cmd: "send test message to telegram" },
  ];

  return (
    <div className="space-y-4">
      {/* Quick commands */}
      <div className="flex flex-wrap gap-2">
        {quickCommands.map((qc) => (
          <button
            key={qc.cmd}
            onClick={() => setCommand(qc.cmd)}
            className="px-3 py-1.5 rounded-lg text-xs bg-white/8 border border-white/10 text-white/70 hover:bg-white/15 hover:text-white transition-all"
          >
            <Zap className="h-3 w-3 inline mr-1.5" />{qc.label}
          </button>
        ))}
      </div>

      {/* Terminal */}
      <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden font-mono">
        <div className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2">
          <Terminal className="h-4 w-4 text-white/40" />
          <span className="text-xs text-white/40">OpenClaw Terminal</span>
          <div className="ml-auto flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
          </div>
        </div>
        <div className="p-4 min-h-[200px] max-h-[300px] overflow-y-auto space-y-1 text-sm">
          {log.length === 0 && (
            <p className="text-white/30 text-xs">Digita un comando per iniziare...</p>
          )}
          {log.map((entry, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-white/25 text-xs shrink-0">{entry.ts}</span>
              <span
                className={
                  entry.type === "out"
                    ? "text-cyan-400"
                    : entry.type === "err"
                    ? "text-red-400"
                    : "text-green-400"
                }
              >
                {entry.msg}
              </span>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 flex items-center gap-2 p-3">
          <span className="text-white/30 text-xs">$</span>
          <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendCommand()}
            placeholder="Digita un comando..."
            className="flex-1 bg-transparent border-0 text-white text-sm focus-visible:ring-0 p-0 h-auto font-mono placeholder:text-white/20"
          />
          <Button
            size="sm"
            onClick={sendCommand}
            disabled={sending || !command.trim()}
            className="bg-white/10 hover:bg-white/20 text-white border-0 h-7 px-3"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Recent agent logs */}
      <div>
        <h3 className="text-sm font-medium text-white/70 mb-3">Log Agenti Recenti</h3>
        <div className="space-y-1.5">
          {recentLogs.length === 0 && (
            <p className="text-white/30 text-xs text-center py-4">Nessun log disponibile</p>
          )}
          {recentLogs.map((log: any) => (
            <div
              key={log.id}
              className="flex items-start gap-3 px-3 py-2 rounded-lg bg-white/5 border border-white/8 text-xs"
            >
              <span
                className={`mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ${
                  log.log_level === "error"
                    ? "bg-red-400"
                    : log.log_level === "warning"
                    ? "bg-yellow-400"
                    : "bg-green-400"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white/60 font-medium">{log.agent_name}</span>
                  {log.action && <span className="text-white/30">· {log.action}</span>}
                  <span className="ml-auto text-white/25 shrink-0">
                    {log.created_at ? format(new Date(log.created_at), "HH:mm:ss") : ""}
                  </span>
                </div>
                <p className="text-white/50 mt-0.5 truncate">{log.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OpenClawDashboard() {
  const { userId } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") ?? "chat");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const { data: stats } = useQuery({
    queryKey: ["openclaw-stats", userId],
    queryFn: async () => {
      if (!userId) return null;
      const [conv, leads, imgs] = await Promise.all([
        supabase
          .from("unvrs_conversations")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "active"),
        supabase
          .from("unvrs_leads")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "new"),
        supabase
          .from("ai_social_content")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "completed"),
      ]);
      return {
        activeConversations: conv.count ?? 0,
        newLeads: leads.count ?? 0,
        totalImages: imgs.count ?? 0,
      };
    },
    enabled: !!userId,
    refetchInterval: 30000,
  });

  if (!userId) return null;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Bot className="h-5 w-5 text-white" />
              </div>
              OpenClaw
            </h1>
            <p className="text-white/40 text-sm mt-1">Bot Telegram · Leads · Immagini · Controllo</p>
          </div>

          {/* Quick stats */}
          {stats && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-white/60">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span>{stats.activeConversations} conversazioni attive</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/60">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span>{stats.newLeads} nuovi leads</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/60">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span>{stats.totalImages} immagini</span>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/8 border border-white/10">
            <TabsTrigger value="chat" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/60">
              <MessageCircle className="h-4 w-4 mr-1.5" /> Chat
            </TabsTrigger>
            <TabsTrigger value="leads" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/60">
              <Users className="h-4 w-4 mr-1.5" /> Leads
            </TabsTrigger>
            <TabsTrigger value="images" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/60">
              <Image className="h-4 w-4 mr-1.5" /> Immagini
            </TabsTrigger>
            <TabsTrigger value="bot" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/60">
              <Terminal className="h-4 w-4 mr-1.5" /> Bot Control
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="mt-5">
            <ChatTab userId={userId} />
          </TabsContent>
          <TabsContent value="leads" className="mt-5">
            <LeadsTab userId={userId} />
          </TabsContent>
          <TabsContent value="images" className="mt-5">
            <ImagesTab userId={userId} />
          </TabsContent>
          <TabsContent value="bot" className="mt-5">
            <BotControlTab userId={userId} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
