import { ICondition } from "@/types/workflow";
import ConditionEditor from "./ConditionEditor";
import { Label } from "@/components/ui/label";

interface IfConfigProps {
  config: { conditions?: ICondition[] };
  onChange: (config: any) => void;
}

export default function IfConfig({ config, onChange }: IfConfigProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Conditions (AND)</Label>
        <p className="text-[10px] text-muted-foreground mb-2">All conditions must match for the TRUE branch.</p>
      </div>
      <ConditionEditor
        conditions={config.conditions || []}
        onChange={(conditions) => onChange({ ...config, conditions })}
      />
    </div>
  );
}
