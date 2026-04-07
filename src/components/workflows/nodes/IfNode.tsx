import { Handle, Position, NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";

export default function IfNode({ data, selected }: NodeProps) {
  const config = data.config ? (typeof data.config === "string" ? JSON.parse(data.config) : data.config) : {};
  const conditions = config.conditions || [];

  return (
    <div className={`px-4 py-3 rounded-lg border-2 bg-background min-w-[200px] ${selected ? "border-blue-500" : "border-yellow-500"}`}>
      <Handle type="target" position={Position.Top} className="!bg-yellow-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded bg-yellow-500/10">
          <GitBranch className="h-4 w-4 text-yellow-500" />
        </div>
        <p className="text-xs font-medium text-foreground">IF</p>
      </div>
      {conditions.length > 0 ? (
        <div className="space-y-1">
          {conditions.map((c: any, i: number) => (
            <p key={i} className="text-[10px] text-muted-foreground truncate">
              {c.type}{c.city ? `: ${c.city}` : ""}{c.personId ? " (person)" : ""}{c.value !== undefined ? `: ${c.value}` : ""}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">No conditions set</p>
      )}
      <div className="flex justify-between mt-3 px-2">
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-green-500 font-medium">TRUE</span>
          <Handle type="source" position={Position.Bottom} id="true" className="!bg-green-500 !w-2.5 !h-2.5 !relative !transform-none !left-0 !top-0 !mt-1" />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-red-500 font-medium">FALSE</span>
          <Handle type="source" position={Position.Bottom} id="false" className="!bg-red-500 !w-2.5 !h-2.5 !relative !transform-none !left-0 !top-0 !mt-1" />
        </div>
      </div>
    </div>
  );
}
