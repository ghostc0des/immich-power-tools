import PageLayout from "@/components/layouts/PageLayout";
import Header from "@/components/shared/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog } from "@/components/ui/alert-dialog";
import Loader from "@/components/ui/loader";
import { listWorkflows, createWorkflow, deleteWorkflow, exportWorkflow, importWorkflow } from "@/handlers/api/workflow.handler";
import { IWorkflow } from "@/types/workflow";
import { Plus, Download, Upload, Trash2, Pencil, Workflow } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<IWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const data = await listWorkflows();
      setWorkflows(data);
    } catch {
      toast({ title: "Error", description: "Failed to load workflows", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleCreate = async () => {
    try {
      const workflow = await createWorkflow({ name: "Untitled Workflow" });
      router.push(`/workflows/${workflow.id}`);
    } catch {
      toast({ title: "Error", description: "Failed to create workflow", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWorkflow(id);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      toast({ title: "Deleted", description: "Workflow deleted" });
    } catch {
      toast({ title: "Error", description: "Failed to delete workflow", variant: "destructive" });
    }
  };

  const handleExport = async (id: string, name: string) => {
    try {
      const data = await exportWorkflow(id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.replace(/[^a-zA-Z0-9]/g, "_")}.workflow.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error", description: "Failed to export workflow", variant: "destructive" });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const workflow = await importWorkflow(data);
      setWorkflows((prev) => [workflow, ...prev]);
      toast({ title: "Imported", description: `Workflow "${workflow.name}" imported` });
    } catch {
      toast({ title: "Error", description: "Failed to import workflow. Check the file format.", variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <PageLayout>
      <Header
        leftComponent="Workflows"
        rightComponent={
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" />
              Import
            </Button>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-1" />
              New Workflow
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-12"><Loader /></div>
      ) : workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Workflow className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No workflows yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first workflow to start automating your library organization.
          </p>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Create Workflow
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {workflows.map((w) => (
            <Card key={w.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{w.name}</CardTitle>
                    {w.description && (
                      <CardDescription className="mt-1 line-clamp-2">{w.description}</CardDescription>
                    )}
                  </div>
                  <Badge variant={w.enabled ? "default" : "secondary"} className="ml-2 shrink-0">
                    {w.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-end gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {w.cronSchedule && <Badge variant="outline" className="text-xs">Scheduled</Badge>}
                  {w.webhookToken && <Badge variant="outline" className="text-xs">Webhook</Badge>}
                  <span className="ml-auto">
                    {w.updatedAt ? format(new Date(w.updatedAt), "MMM d, yyyy") : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => router.push(`/workflows/${w.id}`)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleExport(w.id, w.name)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog
                    title="Delete workflow?"
                    description={`This will permanently delete "${w.name}" and all its nodes, edges, and run history.`}
                    onConfirm={() => handleDelete(w.id)}
                  >
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
