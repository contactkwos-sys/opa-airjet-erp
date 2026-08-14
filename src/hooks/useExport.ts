import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export function useExport() {
  const [busy, setBusy] = useState(false);

  return useMemo(
    () => ({
      busy,
      exportCsv: (filename: string, rows: Record<string, unknown>[]) => {
        if (!rows.length) return;
        const headers = Object.keys(rows[0]);
        const lines = [
          headers.join(","),
          ...rows.map((r) =>
            headers
              .map((h) => {
                const v = r[h];
                const s = v == null ? "" : String(v);
                return `"${s.replace(/"/g, '""')}"`;
              })
              .join(",")
          ),
        ];
        downloadBlob(filename.endsWith(".csv") ? filename : `${filename}.csv`, lines.join("\n"), "text/csv");
      },
      exportExcel: (filename: string, rows: Record<string, unknown>[], sheet = "Report") => {
        if (!rows.length) return;
        setBusy(true);
        try {
          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.json_to_sheet(rows);
          XLSX.utils.book_append_sheet(wb, ws, sheet);
          XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
        } finally {
          setBusy(false);
        }
      },
      exportPdf: (filename: string, title: string, rows: Record<string, unknown>[]) => {
        if (!rows.length) return;
        setBusy(true);
        try {
          const doc = new jsPDF({ orientation: "landscape" });
          doc.setFontSize(14);
          doc.text("OPA GROUP OF INDIA", 14, 16);
          doc.setFontSize(11);
          doc.text(title, 14, 24);
          const headers = Object.keys(rows[0]);
          autoTable(doc, {
            startY: 30,
            head: [headers],
            body: rows.map((r) => headers.map((h) => String(r[h] ?? ""))),
            styles: { fontSize: 8 },
          });
          doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
        } finally {
          setBusy(false);
        }
      },
    }),
    [busy]
  );
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
