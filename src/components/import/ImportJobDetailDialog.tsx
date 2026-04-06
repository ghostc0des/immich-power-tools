import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getImportJob } from "@/handlers/api/import-jobs.handler";
import { useConfig } from "@/contexts/ConfigContext";

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 p-3">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="text-sm font-medium text-foreground break-words">{value ?? "—"}</p>
  </div>
);

const statusBadge = (status: string) => {
  const styles =
    status === "uploaded" || status === "completed"
      ? "bg-emerald-500/10 text-emerald-600"
      : status === "skipped"
      ? "bg-amber-500/10 text-amber-600"
      : status === "failed"
      ? "bg-destructive/10 text-destructive"
      : "bg-muted text-muted-foreground";

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${styles}`}>
      {status}
    </span>
  );
};

interface ImportJobDetailDialogProps {
  jobId: string | null;
  onClose: () => void;
}

export default function ImportJobDetailDialog({ jobId, onClose }: ImportJobDetailDialogProps) {
  const { exImmichUrl } = useConfig();

  const { data: detailJob, isLoading } = useQuery({
    queryKey: ["import-job-detail", jobId],
    queryFn: () => getImportJob(jobId!),
    enabled: !!jobId,
  });

  let dImportData: Record<string, unknown> = {};
  let dAlbumOpts: { createAlbum?: boolean; albumName?: string; addToAlbumId?: string } | undefined;
  let dError: string | null = null;
  let albumId: string | undefined;

  if (detailJob) {
    try {
      dImportData = JSON.parse(detailJob.job.importData);
    } catch { /* ignore */ }
    dAlbumOpts = dImportData.albumOptions as typeof dAlbumOpts;
    dError = typeof dImportData.error === "string" ? dImportData.error : null;
    albumId = typeof dImportData.albumId === "string" ? dImportData.albumId : undefined;
  }

  return (
    <Dialog open={!!jobId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {detailJob && (() => {
          const dJob = detailJob.job;

          return (
            <>
              <DialogHeader>
                <DialogTitle>{dAlbumOpts?.albumName || "Import details"}</DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoRow label="Status" value={statusBadge(dJob.status)} />
                <InfoRow label="Platform" value={dJob.platform} />
                <InfoRow label="Total" value={dJob.totalCount} />
                <InfoRow label="Uploaded" value={dJob.uploadedCount} />
                <InfoRow label="Skipped" value={dJob.skippedCount} />
                <InfoRow label="Failed" value={dJob.failedCount} />
                {albumId && (
                  <InfoRow label="Album" value={
                    <a
                      href={`${exImmichUrl}/albums/${albumId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {dAlbumOpts?.albumName || albumId}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  } />
                )}
                {!albumId && dAlbumOpts?.albumName && (
                  <InfoRow label="Album" value={dAlbumOpts.albumName} />
                )}
              </div>

              {dError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {dError}
                </div>
              )}

              <div className="flex-1 overflow-auto min-h-0 mt-2">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Asset</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {detailJob.items.map((item) => {
                      let itemData: Record<string, unknown> = {};
                      try { itemData = JSON.parse(item.itemData ?? "{}"); } catch { /* ignore */ }
                      const fileName = (itemData.originalFileName as string) || item.assetId;

                      return (
                        <tr key={item.id}>
                          <td className="py-2 pr-2 max-w-[200px] truncate" title={fileName}>
                            {item.immichId ? (
                              <a
                                href={`${exImmichUrl}/photos/${item.immichId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {fileName}
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                            ) : (
                              fileName
                            )}
                          </td>
                          <td className="py-2 pr-2">
                            {statusBadge(item.status)}
                          </td>
                          <td className="py-2 text-xs text-muted-foreground max-w-[200px] truncate" title={item.error || ""}>
                            {item.error || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}
