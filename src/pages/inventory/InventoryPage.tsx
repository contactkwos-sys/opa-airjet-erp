import { ModulePage } from "@/components/ModulePage";
import type { Row } from "@/lib/api";
import { AlertBanner, type Column } from "@/components/ui";
import { inventoryItemFormSchema } from "@/lib/validation";

type InvRow = Record<string, unknown> & { id: string };

const CATEGORIES = [
  { value: "YARN", label: "YARN" },
  { value: "BEAM", label: "BEAM" },
  { value: "FABRIC", label: "FABRIC" },
  { value: "SPARES", label: "SPARES" },
  { value: "CONSUMABLE", label: "CONSUMABLE" },
  { value: "GENERAL", label: "GENERAL" },
];

const columns: Column<InvRow>[] = [
  { key: "item_code", header: "Code", render: (r) => String(r.item_code ?? "—") },
  { key: "name", header: "Name", render: (r) => String(r.name ?? "—") },
  { key: "category", header: "Category", render: (r) => String(r.category ?? "—") },
  { key: "uom", header: "UOM", render: (r) => String(r.uom ?? "—") },
  {
    key: "current_qty",
    header: "Qty",
    render: (r) => String(r.current_qty ?? "—"),
  },
  {
    key: "reorder_level",
    header: "Reorder",
    render: (r) => String(r.reorder_level ?? "—"),
  },
  {
    key: "unit_cost",
    header: "Unit cost",
    render: (r) => (r.unit_cost != null ? `₹${r.unit_cost}` : "—"),
  },
];

const fields = [
  { name: "item_code", label: "Item code", type: "text" as const, required: true },
  { name: "name", label: "Name", type: "text" as const, required: true },
  {
    name: "category",
    label: "Category",
    type: "select" as const,
    required: true,
    options: CATEGORIES,
  },
  { name: "uom", label: "UOM", type: "text" as const, required: true },
  { name: "current_qty", label: "Current qty", type: "number" as const },
  { name: "reorder_level", label: "Reorder level", type: "number" as const },
  { name: "min_stock", label: "Min stock", type: "number" as const },
  { name: "max_stock", label: "Max stock", type: "number" as const },
  { name: "unit_cost", label: "Unit cost", type: "number" as const },
];

function isLowStock(r: InvRow): boolean {
  const qty = Number(r.current_qty);
  const reorder = Number(r.reorder_level);
  if (!Number.isFinite(qty) || !Number.isFinite(reorder)) return false;
  return qty <= reorder;
}

export default function InventoryPage() {
  return (
    <ModulePage
      title="Inventory"
      subtitle="Item master — Yarn, Beam, Fabric, Spare, Consumable and General stores."
      table="opa_inventory_items"
      moduleKey="inventory"
      columns={columns}
      fields={fields}
      orderBy={{ column: "item_code", ascending: true }}
      schema={inventoryItemFormSchema}
      createDefaults={() => ({
        uom: "PCS",
        category: "GENERAL",
        reorder_level: 0,
        current_qty: 0,
        min_stock: 0,
        max_stock: 0,
        unit_cost: 0,
        is_active: true,
      })}
      banner={(rows: Row[]) => {
        const low = rows.filter(isLowStock);
        const lowText = low
          .map(
            (r) =>
              `${r.item_code ?? r.name} (qty ${r.current_qty} ≤ reorder ${r.reorder_level})`,
          )
          .join(" · ");
        return (
          <>
            <AlertBanner tone="info" title="Categories">
              Use Yarn / Beam / Fabric / Spares / Consumable / General so stores and purchase reports stay aligned with the item master.
            </AlertBanner>
            {low.length > 0 ? (
              <AlertBanner tone="warning" title={`Low stock · ${low.length} item(s)`}>
                {lowText}
              </AlertBanner>
            ) : null}
          </>
        );
      }}
    />
  );
}
