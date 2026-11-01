import React, { useRef, useMemo, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ColGroupDef, GridReadyEvent } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { Download, Search, RefreshCw, Layers } from "lucide-react";
import { BountyRow } from "../types";
import {
  StatusCellRenderer,
  BatchIdCellRenderer,
  RfpIdCellRenderer,
  LatencyCellRenderer
} from "./CellRenderers";

interface BountyGridProps {
  rowData: BountyRow[];
  onRefresh?: () => void;
}

export const BountyGrid: React.FC<BountyGridProps> = ({ rowData, onRefresh }) => {
  const gridRef = useRef<AgGridReact<BountyRow>>(null);

  // Quick Filter text search
  const onFilterTextBoxChanged = useCallback(() => {
    const input = document.getElementById("filter-text-box") as HTMLInputElement;
    gridRef.current?.api.setGridOption("quickFilterText", input.value);
  }, []);

  // Export to CSV
  const onExportCsv = useCallback(() => {
    gridRef.current?.api.exportDataAsCsv({
      fileName: `bounty_settlements_${new Date().toISOString().slice(0, 10)}.csv`
    });
  }, []);

  // Aggregation footer calculations (pinnedBottomRowData)
  const pinnedBottomRowData = useMemo(() => {
    if (!rowData || rowData.length === 0) return [];

    const totalVolume = rowData.reduce((acc, row) => acc + (row.amountPaidUsd || 0), 0);
    const validLatencies = rowData.filter((r) => r.latencyMs > 0);
    const avgLatency = validLatencies.length > 0
      ? Math.round(validLatencies.reduce((acc, r) => acc + r.latencyMs, 0) / validLatencies.length)
      : 0;

    return [
      {
        id: "summary_footer",
        time: "SUMMARY",
        rfpId: `Total Jobs: ${rowData.length}`,
        capability: "—",
        sellerNode: "All Nodes Active",
        status: "SETTLED" as const,
        bidUsd: rowData.reduce((acc, r) => acc + (r.bidUsd || 0), 0),
        amountPaidUsd: totalVolume,
        paypalBatchId: "—",
        latencyMs: avgLatency
      }
    ];
  }, [rowData]);

  // Column definitions with Column Grouping for Financials
  const columnDefs = useMemo<(ColDef<BountyRow> | ColGroupDef<BountyRow>)[]>(() => [
    {
      headerName: "Time",
      field: "time",
      sortable: true,
      filter: "agTextColumnFilter",
      floatingFilter: true,
      width: 105,
      checkboxSelection: (params) => !params.node.isRowPinned(),
      headerCheckboxSelection: true,
      cellClass: "font-mono text-xs text-slate-300"
    },
    {
      headerName: "RFP ID",
      field: "rfpId",
      sortable: true,
      filter: "agTextColumnFilter",
      floatingFilter: true,
      cellRenderer: RfpIdCellRenderer,
      width: 145
    },
    {
      headerName: "Capability",
      field: "capability",
      sortable: true,
      filter: "agTextColumnFilter",
      floatingFilter: true,
      width: 160,
      cellRenderer: (params: any) => (
        <span className="font-mono text-xs text-sky-400 font-medium">
          {params.value}
        </span>
      )
    },
    {
      headerName: "Seller Node",
      field: "sellerNode",
      sortable: true,
      filter: "agTextColumnFilter",
      floatingFilter: true,
      width: 220,
      cellRenderer: (params: any) => (
        <span className="font-mono text-xs text-slate-300">
          {params.value}
        </span>
      )
    },
    {
      headerName: "Status",
      field: "status",
      sortable: true,
      filter: "agTextColumnFilter",
      floatingFilter: true,
      cellRenderer: StatusCellRenderer,
      width: 140
    },
    // Column Group: Financial Settlement (PayPal)
    {
      headerName: "Financial Settlement (PayPal Rails)",
      headerClass: "bg-slate-800/80 text-yellow-400 font-semibold border-b border-yellow-500/30",
      children: [
        {
          headerName: "Bid ($)",
          field: "bidUsd",
          sortable: true,
          filter: "agNumberColumnFilter",
          floatingFilter: true,
          width: 105,
          valueFormatter: (params) =>
            typeof params.value === "number" ? `$${params.value.toFixed(2)}` : params.value,
          cellClass: "font-mono text-xs text-slate-200 tabular-nums font-semibold"
        },
        {
          headerName: "Amount Paid ($)",
          field: "amountPaidUsd",
          sortable: true,
          filter: "agNumberColumnFilter",
          floatingFilter: true,
          width: 135,
          valueFormatter: (params) =>
            typeof params.value === "number" ? `$${params.value.toFixed(2)}` : params.value,
          cellClass: "font-mono text-xs text-emerald-400 tabular-nums font-bold"
        },
        {
          headerName: "PayPal Batch ID",
          field: "paypalBatchId",
          sortable: true,
          filter: "agTextColumnFilter",
          floatingFilter: true,
          cellRenderer: BatchIdCellRenderer,
          width: 175
        }
      ]
    },
    {
      headerName: "Latency (ms)",
      field: "latencyMs",
      sortable: true,
      filter: "agNumberColumnFilter",
      floatingFilter: true,
      cellRenderer: LatencyCellRenderer,
      width: 160
    }
  ], []);

  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: true,
    filter: true
  }), []);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    params.api.sizeColumnsToFit();
  }, []);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl backdrop-blur-sm flex flex-col">
      {/* Grid Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold text-white tracking-wide">
              Real-Time Settlement Ledger
            </h3>
          </div>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono">
            {rowData.length} entries
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Quick Filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="filter-text-box"
              placeholder="Filter transactions..."
              onInput={onFilterTextBoxChanged}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 w-44 sm:w-56 transition-colors"
            />
          </div>

          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Refresh ledger data"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {/* Export CSV Button */}
          <button
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* The AG Grid Canvas */}
      <div
        className="ag-theme-quartz-dark w-full rounded-lg overflow-hidden border border-slate-800"
        style={{ height: "480px" }}
      >
        <AgGridReact<BountyRow>
          ref={gridRef}
          theme="legacy"
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowSelection="multiple"
          suppressRowClickSelection={true}
          pinnedBottomRowData={pinnedBottomRowData}
          onGridReady={onGridReady}
          animateRows={true}
          pagination={true}
          paginationPageSize={10}
          paginationPageSizeSelector={[10, 20, 50]}
        />
      </div>

      {/* Grid Features Sponsor Note */}
      <div className="flex flex-wrap items-center justify-between mt-3 text-[11px] text-slate-500 font-mono">
        <div>
          <span>Features: Column Filtering · Floating Filters · Grouped Financials · Monospace Copy · CSV Export · Pinned Aggregations</span>
        </div>
        <div className="text-yellow-400 font-medium">
          AG Grid Community v33 (Full Open-Source Compliance)
        </div>
      </div>
    </div>
  );
};

