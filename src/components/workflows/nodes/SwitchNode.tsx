import { Handle, Position, NodeProps } from "@xyflow/react";
import { GitFork } from "lucide-react";

export default function SwitchNode({ data, selected }: NodeProps) {
  const config = data.config ? (typeof data.config === "string" ? JSON.parse(data.config) : data.config) : {};
  const cases = config.cases || [];

  return (
    <div className={`px-4 py-3 rounded-lg border-2 bg-background min-w-[220px] ${selected ? "border-blue-500" : "border-orange-500"}`}>
      <Handle type="target" position={Position.Top} className="!bg-orange-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded bg-orange-500/10">
          <GitFork className="h-4 w-4 text-orange-500" />
        </div>
        <p className="text-xs font-medium text-foreground">SWITCH</p>
        <span className="text-[10px] text-muted-foreground ml-auto">{cases.length} cases</span>
      </div>
      {cases.length > 0 && (
        <div className="space-y-1 mb-2">
          {cases.map((c: any, i: number) => (
            <p key={i} className="text-[10px] text-muted-foreground truncate">
              {c.label || `Case ${i + 1}`}
            </p>
          ))}
        </div>
      )}
      <div className="flex justify-between mt-3 px-1 gap-2">
        {cases.map((c: any, i: number) => (
          <div key={c.handle || `case_${i}`} className="flex flex-col items-center">
            <span className="text-[9px] text-orange-500 font-medium truncate max-w-[50px]">{c.label || `C${i + 1}`}</span>
            <Handle type="source" position={Position.Bottom} id={c.handle || `case_${i}`} className="!bg-orange-500 !w-2.5 !h-2.5 !relative !transform-none !left-0 !top-0 !mt-1" />
          </div>
        ))}
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-muted-foreground font-medium">DEF</span>
          <Handle type="source" position={Position.Bottom} id="default" className="!bg-gray-400 !w-2.5 !h-2.5 !relative !transform-none !left-0 !top-0 !mt-1" />
        </div>
      </div>
    </div>
  );
}
