import PageLayout from "@/components/layouts/PageLayout";
import Header from "@/components/shared/Header";
import { deleteApiKey, getApiKeys, regenerateApiKey } from "@/handlers/api/settings.handler";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Trash2, Save, Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import API from "@/lib/api";

interface ApiKey {
  id: string;
  purpose: string;
  keyName: string;
  createdAt: string;
}

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  // Workflow API key
  const [workflowApiKey, setWorkflowApiKey] = useState("");
  const [workflowApiKeyLoading, setWorkflowApiKeyLoading] = useState(false);
  const [showWorkflowApiKey, setShowWorkflowApiKey] = useState(false);

  const fetchWorkflowApiKey = async () => {
    try {
      const data = await API.get("/api/settings/kv/workflow_api_key");
      setWorkflowApiKey(data.value || "");
    } catch {
      // Not set yet
    }
  };

  const saveWorkflowApiKey = async () => {
    setWorkflowApiKeyLoading(true);
    try {
      await API.put("/api/settings/kv/workflow_api_key", { value: workflowApiKey });
      toast.success("Workflow API key saved");
    } catch {
      toast.error("Failed to save workflow API key");
    }
    setWorkflowApiKeyLoading(false);
  };

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const data = await getApiKeys();
      setKeys(data);
    } catch {
      // silently fail — keys list stays empty
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchKeys();
    fetchWorkflowApiKey();
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
      <div className="p-6 flex flex-col gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              Managed API keys created by Power Tools in your Immich instance.
              These are used internally for features that require unauthenticated access (e.g. share links).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
            {!loading && keys.length === 0 && (
              <p className="text-sm text-muted-foreground">No API keys created yet.</p>
            )}
            {!loading && keys.length > 0 && (
              <ul className="flex flex-col divide-y">
                {keys.map((key) => (
                  <li key={key.id} className="flex items-center justify-between py-3 gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{key.keyName}</span>
                        <Badge variant="secondary" className="capitalize">{key.purpose}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Created {new Date(key.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <AlertDialog
                        title="Regenerate API Key"
                        description={`This will delete the current "${key.keyName}" key from Immich and create a new one. Existing share links will continue to work.`}
                        onConfirm={() => handleRegenerate(key.purpose)}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={regenerating === key.purpose || deleting === key.purpose}
                        >
                          <RefreshCw className={`h-4 w-4 ${regenerating === key.purpose ? "animate-spin" : ""}`} />
                        </Button>
                      </AlertDialog>
                      <AlertDialog
                        title="Delete API Key"
                        description={`This will remove the "${key.keyName}" key from Immich and Power Tools. Share links that depend on it will stop serving thumbnails.`}
                        onConfirm={() => handleDelete(key.purpose)}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={deleting === key.purpose || regenerating === key.purpose}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialog>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Workflow API Key</CardTitle>
            <CardDescription>
              Immich API key used by workflows to execute actions (create albums, favorite, archive, etc.).
              This key is used for scheduled and webhook-triggered runs. If not set, workflows will use the session of the user who created them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="workflowApiKey" className="text-xs">API Key</Label>
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowWorkflowApiKey((v) => !v)}
                    >
                      {showWorkflowApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button size="sm" onClick={saveWorkflowApiKey} disabled={workflowApiKeyLoading}>
                    <Save className="h-3.5 w-3.5 mr-1" />
                    {workflowApiKeyLoading ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Create an API key in Immich (Account Settings → API Keys) with full permissions, then paste it here.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
