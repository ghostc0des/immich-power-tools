import PageLayout from "@/components/layouts/PageLayout";
import Header from "@/components/shared/Header";
import { deleteApiKey, getApiKeys, regenerateApiKey } from "@/handlers/api/settings.handler";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RefreshCw, Trash2, Save, Eye, EyeOff, ExternalLink,
  Key, Workflow, Shield, CheckCircle, XCircle, Server, Globe, Download, Wand2,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import API from "@/lib/api";
import { useConfig } from "@/contexts/ConfigContext";
import Link from "next/link";

interface ApiKey {
  id: string;
  purpose: string;
  keyName: string;
  createdAt: string;
}

function ConnectionStatus({ label, url, icon: Icon }: { label: string; url: string; icon: any }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      {url ? (
        <div className="flex items-center gap-1.5">
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
          <span className="text-xs font-mono text-foreground">{url}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <XCircle className="h-3.5 w-3.5 text-destructive" />
          <span className="text-xs text-muted-foreground">Not configured</span>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { exImmichUrl, immichURL, version, aiEnabled } = useConfig();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  const [workflowApiKey, setWorkflowApiKey] = useState("");
  const [workflowApiKeyLoading, setWorkflowApiKeyLoading] = useState(false);
  const [showWorkflowApiKey, setShowWorkflowApiKey] = useState(false);
  const [workflowApiKeySaved, setWorkflowApiKeySaved] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean; error: string | null; permissions: string[]; missing: string[];
  } | null>(null);

  const [importApiKey, setImportApiKey] = useState("");
  const [importApiKeyLoading, setImportApiKeyLoading] = useState(false);
  const [showImportApiKey, setShowImportApiKey] = useState(false);
  const [importApiKeySaved, setImportApiKeySaved] = useState(false);
  const [generatingImportKey, setGeneratingImportKey] = useState(false);

  const fetchWorkflowApiKey = async () => {
    try {
      const data = await API.get("/api/settings/kv/workflow_api_key");
      setWorkflowApiKey(data.value || "");
      setWorkflowApiKeySaved(!!data.value);
    } catch {
      setWorkflowApiKeySaved(false);
    }
  };

  const fetchImportApiKey = async () => {
    try {
      const data = await API.get("/api/settings/kv/import_api_key");
      setImportApiKey(data.value || "");
      setImportApiKeySaved(!!data.value);
    } catch {
      setImportApiKeySaved(false);
    }
  };

  const saveImportApiKey = async () => {
    setImportApiKeyLoading(true);
    try {
      await API.put("/api/settings/kv/import_api_key", { value: importApiKey.trim() });
      setImportApiKeySaved(!!importApiKey.trim());
      toast.success(importApiKey.trim() ? "Import API key saved" : "Import API key cleared");
    } catch {
      toast.error("Failed to save import API key");
    }
    setImportApiKeyLoading(false);
  };

  const handleGenerateImportKey = async () => {
    setGeneratingImportKey(true);
    try {
      await API.post("/api/settings/generate-import-api-key", {});
      await fetchImportApiKey();
      toast.success("Import API key generated and saved");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to generate import API key");
    }
    setGeneratingImportKey(false);
  };

  const saveWorkflowApiKey = async () => {
    if (!workflowApiKey.trim()) {
      // Clear the key
      setWorkflowApiKeyLoading(true);
      try {
        await API.put("/api/settings/kv/workflow_api_key", { value: "" });
        setWorkflowApiKeySaved(false);
        setValidationResult(null);
        toast.success("Workflow API key cleared");
      } catch {
        toast.error("Failed to clear workflow API key");
      }
      setWorkflowApiKeyLoading(false);
      return;
    }

    setWorkflowApiKeyLoading(true);
    setValidationResult(null);
    toast("Validating API key...");

    try {
      // Validate first
      const result = await API.post("/api/settings/validate-api-key", { apiKey: workflowApiKey });
      setValidationResult(result);

      if (!result.valid) {
        toast.error(result.error || "API key validation failed");
        setWorkflowApiKeyLoading(false);
        return;
      }

      // Valid — save it
      await API.put("/api/settings/kv/workflow_api_key", { value: workflowApiKey });
      setWorkflowApiKeySaved(true);
      toast.success("API key validated and saved");
    } catch {
      toast.error("Failed to validate API key");
    }
    setWorkflowApiKeyLoading(false);
  };

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const data = await getApiKeys();
      setKeys(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchKeys();
    fetchWorkflowApiKey();
    fetchImportApiKey();
  }, []);

  const handleDelete = async (purpose: string) => {
    setDeleting(purpose);
    try {
      await deleteApiKey(purpose);
      setKeys((prev) => prev.filter((k) => k.purpose !== purpose));
      toast.success("API key deleted");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to delete API key");
    }
    setDeleting(null);
  };

  const handleRegenerate = async (purpose: string) => {
    setRegenerating(purpose);
    try {
      await regenerateApiKey(purpose);
      await fetchKeys();
      toast.success("API key regenerated");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to regenerate API key");
    }
    setRegenerating(null);
  };

  return (
    <PageLayout>
      <Header leftComponent="Settings" />
      <div className="p-6 max-w-2xl space-y-8">

        {/* Connection Info */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Server className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Connection</h2>
            {version && <Badge variant="outline" className="text-[10px] h-4 ml-auto font-mono">v{version}</Badge>}
          </div>
          <div className="border rounded-lg px-4 divide-y">
            <ConnectionStatus label="Internal URL" url={immichURL} icon={Server} />
            <ConnectionStatus label="External URL" url={exImmichUrl} icon={Globe} />
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2.5">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">AI Search</span>
              </div>
              <Badge variant={aiEnabled ? "default" : "secondary"} className="text-[10px]">
                {aiEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </div>
        </section>

        {/* Workflow API Key */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Workflow className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Workflow API Key</h2>
            {workflowApiKeySaved ? (
              <CheckCircle className="h-3.5 w-3.5 text-green-500 ml-auto" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-yellow-500 ml-auto" />
            )}
          </div>
          <div className="border rounded-lg p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Immich API key used by workflows for scheduled and webhook-triggered runs.
              Needs permissions for assets, albums, and tags.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="workflowApiKey"
                  type={showWorkflowApiKey ? "text" : "password"}
                  className="h-9 text-sm font-mono pr-10"
                  placeholder="Paste your Immich API key here"
                  value={workflowApiKey}
                  onChange={(e) => setWorkflowApiKey(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowWorkflowApiKey((v) => !v)}
                >
                  {showWorkflowApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button size="sm" className="h-9" onClick={saveWorkflowApiKey} disabled={workflowApiKeyLoading}>
                <Save className="h-3.5 w-3.5 mr-1" />
                {workflowApiKeyLoading ? "Saving..." : "Save"}
              </Button>
            </div>
            {validationResult && (
              <div className={`rounded-md p-2.5 text-xs ${validationResult.valid ? "bg-green-500/10 border border-green-500/20" : "bg-destructive/10 border border-destructive/20"}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  {validationResult.valid ? (
                    <><CheckCircle className="h-3.5 w-3.5 text-green-500" /><span className="font-medium text-green-600 dark:text-green-400">All permissions verified</span></>
                  ) : (
                    <><XCircle className="h-3.5 w-3.5 text-destructive" /><span className="font-medium text-destructive">{validationResult.error}</span></>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {["asset.read", "asset.update", "album.create", "album.update", "tag.create"].map((p) => {
                    const granted = validationResult.permissions.includes(p);
                    const missing = validationResult.missing.includes(p);
                    return (
                      <Badge
                        key={p}
                        variant="outline"
                        className={`text-[10px] h-5 font-mono font-normal ${granted ? "border-green-500/40 text-green-600 dark:text-green-400" : missing ? "border-destructive/40 text-destructive" : ""}`}
                      >
                        {granted ? "✓" : "✗"} {p}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
            {!validationResult && (
              <div className="flex flex-wrap gap-1">
                {["asset.read", "asset.update", "album.create", "album.update", "tag.create"].map((p) => (
                  <Badge key={p} variant="outline" className="text-[10px] h-5 font-mono font-normal">{p}</Badge>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">Required permissions</p>
              {exImmichUrl && (
                <Link
                  href={`${exImmichUrl}/user-settings?isOpen=api-keys`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0 ml-3"
                >
                  Create in Immich
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* Import API Key */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Download className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Import API Key</h2>
            {importApiKeySaved ? (
              <CheckCircle className="h-3.5 w-3.5 text-green-500 ml-auto" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-yellow-500 ml-auto" />
            )}
          </div>
          <div className="border rounded-lg p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Immich API key used when importing from shared links. Needs asset upload, album, and tag permissions.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showImportApiKey ? "text" : "password"}
                  className="h-9 text-sm font-mono pr-10"
                  placeholder="Paste your Immich API key here"
                  value={importApiKey}
                  onChange={(e) => setImportApiKey(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowImportApiKey((v) => !v)}
                >
                  {showImportApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button size="sm" className="h-9" onClick={saveImportApiKey} disabled={importApiKeyLoading}>
                <Save className="h-3.5 w-3.5 mr-1" />
                {importApiKeyLoading ? "Saving..." : "Save"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {["asset.read", "asset.upload", "album.read", "album.create", "album.update", "tag.create"].map((p) => (
                <Badge key={p} variant="outline" className="text-[10px] h-5 font-mono font-normal">{p}</Badge>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={handleGenerateImportKey}
                disabled={generatingImportKey}
              >
                <Wand2 className="h-3 w-3 mr-1" />
                {generatingImportKey ? "Generating..." : "Generate automatically"}
              </Button>
              {exImmichUrl && (
                <Link
                  href={`${exImmichUrl}/user-settings?isOpen=api-keys`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Create in Immich
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* Managed API Keys */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Key className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Managed API Keys</h2>
            <span className="text-xs text-muted-foreground ml-auto">{keys.length} key{keys.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="border rounded-lg">
            {loading ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : keys.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <Key className="h-5 w-5 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No managed API keys yet.</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Keys are created automatically when needed (e.g. share links).</p>
              </div>
            ) : (
              <ul className="divide-y">
                {keys.map((key) => (
                  <li key={key.id} className="flex items-center justify-between px-4 py-3 gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Key className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{key.keyName}</span>
                          <Badge variant="secondary" className="capitalize text-[10px] h-4">{key.purpose}</Badge>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          Created {new Date(key.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <AlertDialog
                        title="Regenerate API Key"
                        description={`This will delete the current "${key.keyName}" key from Immich and create a new one.`}
                        onConfirm={() => handleRegenerate(key.purpose)}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={regenerating === key.purpose || deleting === key.purpose}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${regenerating === key.purpose ? "animate-spin" : ""}`} />
                        </Button>
                      </AlertDialog>
                      <AlertDialog
                        title="Delete API Key"
                        description={`This will remove the "${key.keyName}" key. Share links that depend on it will stop working.`}
                        onConfirm={() => handleDelete(key.purpose)}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={deleting === key.purpose || regenerating === key.purpose}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </AlertDialog>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
