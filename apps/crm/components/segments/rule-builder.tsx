"use client";

import { GripVertical, Plus, Trash2 } from "lucide-react";
import type { SegmentCondition, SegmentDSL, SegmentGroup } from "@xeno/shared-types";
import { useState } from "react";

const fields = ["totalOrderValue", "lastOrderAt", "totalOrders", "tags", "city", "channel_preference"] as const;
const operators = ["gt", "lt", "eq", "contains", "between", "in"] as const;

function isGroup(rule: SegmentCondition | SegmentGroup): rule is SegmentGroup { return "rules" in rule; }

function parseValue(condition: SegmentCondition, raw: string): SegmentCondition["value"] {
  if (condition.operator === "between" || condition.operator === "in") {
    const values = raw.split(",").map((item) => item.trim()).filter(Boolean);
    return condition.field === "totalOrderValue" || condition.field === "totalOrders" ? values.map(Number) : values;
  }
  return condition.field === "totalOrderValue" || condition.field === "totalOrders" ? Number(raw) : raw;
}

function RuleGroupEditor({ group, onChange, depth = 0 }: { group: SegmentGroup; onChange: (group: SegmentGroup) => void; depth?: number }): JSX.Element {
  const [dragged, setDragged] = useState<number | null>(null);
  function replace(index: number, rule: SegmentCondition | SegmentGroup): void { onChange({ ...group, rules: group.rules.map((item, itemIndex) => itemIndex === index ? rule : item) }); }
  function move(target: number): void {
    if (dragged === null || dragged === target) return;
    const rules = [...group.rules];
    const [item] = rules.splice(dragged, 1);
    if (item) rules.splice(target, 0, item);
    setDragged(null);
    onChange({ ...group, rules });
  }
  return <div className={depth ? "rounded-md border border-line bg-[#f8faf9] p-3" : "space-y-3"}>
    <div className="mb-3 flex flex-wrap items-center gap-2"><span className="text-sm text-[#65736e]">Match</span><select className="input w-24" value={group.operator} onChange={(event) => onChange({ ...group, operator: event.target.value as "AND" | "OR" })}><option>AND</option><option>OR</option></select><span className="text-sm text-[#65736e]">of these rules</span></div>
    <div className="space-y-2">{group.rules.map((rule, index) => <div key={index} draggable onDragStart={() => setDragged(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => move(index)} className="flex min-w-0 items-start gap-2">
      <button type="button" className="mt-2 text-[#8b9792]" title="Drag to reorder" aria-label="Drag to reorder"><GripVertical size={16} /></button>
      <div className="min-w-0 flex-1">{isGroup(rule) ? <RuleGroupEditor group={rule} depth={depth + 1} onChange={(nested) => replace(index, nested)} /> : <div className="grid grid-cols-[1.2fr_1fr_1.3fr] gap-2"><select className="input" value={rule.field} onChange={(event) => replace(index, { ...rule, field: event.target.value as SegmentCondition["field"] })}>{fields.map((field) => <option key={field}>{field}</option>)}</select><select className="input" value={rule.operator} onChange={(event) => replace(index, { ...rule, operator: event.target.value as SegmentCondition["operator"] })}>{operators.map((operator) => <option key={operator}>{operator}</option>)}</select><input className="input" value={Array.isArray(rule.value) ? rule.value.join(",") : rule.value} onChange={(event) => replace(index, { ...rule, value: parseValue(rule, event.target.value) })} /></div>}</div>
      <button type="button" className="btn mt-0 size-9 shrink-0 p-0" aria-label="Remove rule" onClick={() => onChange({ ...group, rules: group.rules.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={15} /></button>
    </div>)}</div>
    <div className="mt-3 flex gap-2"><button type="button" className="btn" onClick={() => onChange({ ...group, rules: [...group.rules, { field: "totalOrderValue", operator: "gt", value: 500 }] })}><Plus size={15} /> Condition</button><button type="button" className="btn" onClick={() => onChange({ ...group, rules: [...group.rules, { operator: "OR", rules: [{ field: "city", operator: "eq", value: "Austin" }] }] })}><Plus size={15} /> Group</button></div>
  </div>;
}

export function RuleBuilder({ value, onChange }: { value: SegmentDSL; onChange: (value: SegmentDSL) => void }): JSX.Element {
  return <RuleGroupEditor group={value} onChange={onChange} />;
}
