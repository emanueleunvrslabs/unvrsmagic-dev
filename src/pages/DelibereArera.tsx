/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  RefreshCw,
  Send,
} from "lucide-react";
import { DeliberaCard } from "@/components/arera/DeliberaCard";
import "@/components/labs/SocialMediaCard.css";

interface AreraDelibera {
  id: string;
  delibera_code: string;
  publication_date: string | null;
  title: string;
  description: string | null;
  summary: string | null;
  category: string | null;
  detail_url: string | null;
  files: Array<{ name: string; url: string; originalUrl?: string }> | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface LogEntry {
  type: "info" | "success" | "error";
  message: string;
  timestamp: Date;
}

const DelibereAreraPage = () => {
  const { toast } = useToast();

  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdminUser, setIsAdminUser] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isAutoSendModalOpen, setIsAutoSendModalOpen] = useState(false);
  const [autoSendEmail, setAutoSendEmail] = useState("");
  const [autoSendCategories, setAutoSendCategories] = useState<string[]>([]);
  const [isSavingAutoSend, setIsSavingAutoSend] = useState(false);

  const logsEndRef = useRef<HTMLDivElement | null>(null);

  const { data: delibere = [], isLoading, refetch } = useQuery<AreraDelibera[]>({
    queryKey: ["arera-delibere"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("arera_delibere")
          .select("*")
          .order("publication_date", { ascending: false });

        if (error) {
          console.error("Error fetching delibere:", error);
          toast({
            title: "Errore",
            description:
              "Impossibile caricare le delibere ARERA. Riprova più tardi.",
            variant: "destructive",
          });
          return [];
        }

        return data as unknown as AreraDelibera[];
      } catch (err) {
        console.error("Unexpected error fetching delibere:", err);
        toast({
          title: "Errore",
          description:
            "Si è verificato un errore imprevisto nel caricamento delle delibere.",
          variant: "destructive",
        });
        return [];
      }
    },
    enabled: true,
  });

  const completedCount = delibere.filter((d) => d.status === "completed").length;
  const processingCount = delibere.filter((d) => d.status === "processing").length;
  const errorCount = delibere.filter((d) => d.status === "error").length;

  useEffect(() => {
    const loadAuth = async () => {
      setAuthLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user ?? null);

      if (user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        setIsAdminUser(
          roleData?.role === "owner" || roleData?.role === "admin",
        );
      } else {
        setIsAdminUser(false);
      }

      setAuthLoading(false);
    };

    loadAuth();
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const appendLog = (entry: LogEntry) => {
    setLogs((prev) => [...prev, entry]);
  };

  const handleSync = async () => {
    if (!isAdminUser) return;

    setIsSyncing(true);
    setLogs([]);

    appendLog({
      type: "info",
      message: "Avvio sincronizzazione con il sito ARERA...",
      timestamp: new Date(),
    });

    try {
      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        appendLog({
          type: "error",
          message: "Non sei autenticato. Effettua il login e riprova.",
          timestamp: new Date(),
        });
        toast({
          title: "Non autenticato",
          description: "Effettua il login per sincronizzare le delibere.",
          variant: "destructive",
        });
        setIsSyncing(false);
        return;
      }

      const projectUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const functionUrl = `${projectUrl}/functions/v1/arera-scraper`;

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        },
        body: JSON.stringify({ action: "sync" }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Sync error:", errorText);
        appendLog({
          type: "error",
          message: `Errore nella chiamata alla funzione di sincronizzazione: ${response.status}`,
          timestamp: new Date(),
        });
        toast({
          title: "Errore nella sincronizzazione",
          description:
            "Si è verificato un errore durante la sincronizzazione delle delibere.",
          variant: "destructive",
        });
        return;
      }

      const result = await response.json();

      appendLog({
        type: "success",
        message: `Sincronizzazione completata. Trovate ${result.totalFound} delibere, elaborate ${result.newProcessed}.`,
        timestamp: new Date(),
      });

      if (Array.isArray(result.results)) {
        interface SyncResult {
          code: string;
          status: string;
          category?: string;
          error?: string;
        }
        result.results.forEach((r: SyncResult) => {
          appendLog({
            type: r.status === "completed" ? "success" : "error",
            message:
              r.status === "completed"
                ? `Delibera ${r.code} elaborata con successo (categoria: ${r.category || "n.d."})`
                : `Errore elaborando la delibera ${r.code}: ${r.error || "Errore sconosciuto"}`,
            timestamp: new Date(),
          });
        });
      }

      toast({
        title: "Sincronizzazione completata",
        description: "Le delibere ARERA sono state aggiornate.",
      });

      refetch();
    } catch (error) {
      console.error("Unexpected sync error:", error);
      appendLog({
        type: "error",
        message: "Errore imprevisto durante la sincronizzazione.",
        timestamp: new Date(),
      });
      toast({
        title: "Errore imprevisto",
        description:
          "Si è verificato un errore imprevisto durante la sincronizzazione.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveAutoSend = async () => {
    if (!user) return;

    if (!autoSendEmail) {
      toast({
        title: "Email mancante",
        description: "Inserisci un indirizzo email valido.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingAutoSend(true);

    try {
      const { error } = await supabase.from("arera_email_preferences").upsert({
        user_id: user.id,
        email: autoSendEmail,
        categories: autoSendCategories,
        active: autoSendCategories.length > 0,
      });

      if (error) {
        console.error("Error saving email preferences:", error);
        toast({
          title: "Errore",
          description:
            "Impossibile salvare le preferenze di invio automatico. Riprova.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Preferenze salvate",
        description: "Le impostazioni di invio automatico sono state aggiornate.",
      });

      setIsAutoSendModalOpen(false);
    } catch (err) {
      console.error("Unexpected error saving preferences:", err);
      toast({
        title: "Errore",
        description:
          "Si è verificato un errore imprevisto nel salvataggio delle preferenze.",
        variant: "destructive",
      });
    } finally {
      setIsSavingAutoSend(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <div>
          <h2 className="text-xl font-semibold mb-2">
            Effettua l'accesso per visualizzare le delibere ARERA
          </h2>
          <p className="text-muted-foreground max-w-md">
            Le delibere ARERA sono disponibili solo agli utenti autenticati.
            Accedi per continuare.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      <header className="flex items-center gap-3">
          {isAdminUser && (
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={isSyncing}
              className="gap-2"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Sincronizzazione in corso...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Sincronizza
                </>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => setIsAutoSendModalOpen(true)}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Invio automatico
          </Button>
      </header>

      <div className="space-y-6">
        {isAdminUser && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="labs-client-card relative rounded-2xl overflow-hidden">
              <div className="relative flex items-center gap-3 p-5 z-10">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Totale Delibere</p>
                  <p className="text-2xl font-bold text-white">{delibere.length}</p>
                </div>
              </div>
            </div>
            <div className="labs-client-card relative rounded-2xl overflow-hidden">
              <div className="relative flex items-center gap-3 p-5 z-10">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Download className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">File Scaricati</p>
                  <p className="text-2xl font-bold text-white">
                    {delibere.reduce(
                      (acc, d) => acc + (d.files?.length || 0),
                      0,
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="labs-client-card relative rounded-2xl overflow-hidden">
              <div className="relative flex items-center gap-3 p-5 z-10">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Clock
                    className={`h-5 w-5 text-yellow-400 ${
                      processingCount > 0 ? "animate-pulse" : ""
                    }`}
                  />
                </div>
                <div>
                  <p className="text-sm text-gray-400">In Elaborazione</p>
                  <p className="text-2xl font-bold text-white">
                    {processingCount}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delibere List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="labs-client-card relative rounded-2xl overflow-hidden">
              <div className="relative py-8 text-center z-10">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">
                  Caricamento delibere...
                </p>
              </div>
            </div>
          ) : delibere.length === 0 ? (
            <div className="labs-client-card relative rounded-2xl overflow-hidden">
              <div className="relative py-8 text-center z-10">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">
                  Nessuna delibera presente. Clicca "Sincronizza" per scaricare le
                  delibere ARERA.
                </p>
              </div>
            </div>
          ) : (
            delibere.map((delibera) => (
              <DeliberaCard key={delibera.id} delibera={delibera} />
            ))
          )}
        </div>
      </div>

      {/* Modal Invio Automatico */}
      <Dialog open={isAutoSendModalOpen} onOpenChange={setIsAutoSendModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invio automatico delibere</DialogTitle>
            <DialogDescription>
              Inserisci l'email e seleziona le categorie di delibere che vuoi
              ricevere automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="esempio@email.com"
                value={autoSendEmail}
                onChange={(e) => setAutoSendEmail(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Label>Categorie da ricevere</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "elettricita", label: "Elettricità" },
                  { value: "gas", label: "Gas" },
                  { value: "acqua", label: "Acqua" },
                  { value: "rifiuti", label: "Rifiuti" },
                  { value: "teleriscaldamento", label: "Teleriscaldamento" },
                  { value: "generale", label: "Generale" },
                ].map((cat) => (
                  <label
                    key={cat.value}
                    className="flex items-center space-x-2 text-sm text-muted-foreground cursor-pointer"
                  >
                    <Checkbox
                      checked={autoSendCategories.includes(cat.value)}
                      onCheckedChange={(checked) => {
                        setAutoSendCategories((prev) =>
                          checked
                            ? [...prev, cat.value]
                            : prev.filter((c) => c !== cat.value),
                        );
                      }}
                    />
                    <span>{cat.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Se non selezioni nessuna categoria, l'invio automatico verrà
                disattivato.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsAutoSendModalOpen(false)}
            >
              Annulla
            </Button>
            <Button onClick={handleSaveAutoSend} disabled={isSavingAutoSend}>
              {isSavingAutoSend ? "Salvataggio..." : "Salva preferenze"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  </DashboardLayout>
  );
};

export default DelibereAreraPage;
