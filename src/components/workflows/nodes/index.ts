import TriggerNode from "./TriggerNode";
import IfNode from "./IfNode";
import SwitchNode from "./SwitchNode";
import ActionNode from "./ActionNode";

export const nodeTypes = {
  trigger: TriggerNode,
  logic_if: IfNode,
  logic_switch: SwitchNode,
  action: ActionNode,
};
