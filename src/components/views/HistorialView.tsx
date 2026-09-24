import React, { useState } from 'react';
import { DailyYieldRecord } from '../../types/finance';
import { formatMXN } from '../../utils/calculator';

import { BankInstitution } from '../../types/finance';

interface HistorialViewProps {
  records: DailyYieldRecord[];
  institutions?: BankInstitution[];
}

export const HistorialView: React.FC<HistorialViewProps> = ({ records, institutions = [] }) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const filterOptions = [
    { id: 'all', label: 'Todos los bancos' },
    ...institutions.map((inst) => ({
      id: inst.id,
      label: inst.name,
    })),
  ];

  const selectedInstitution = institutions.find((inst) => inst.id === selectedFilter);

  const filteredRecords =
    selectedFilter === 'all'
      ? records
      : records.filter((r) => {
          if (!selectedInstitution) return false;

          const matchesName =
            r.bankName.toLowerCase() === selectedInstitution.name.toLowerCase() ||
            r.bankName.toLowerCase().includes(selectedInstitution.name.toLowerCase()) ||
            r.bankName.toLowerCase().includes(selectedInstitution.shortName.toLowerCase());

          const matchesShortCode = r.shortCode.toLowerCase() === selectedInstitution.shortName.toLowerCase() ||
            r.shortCode.toLowerCase() === selectedInstitution.name.toLowerCase().slice(0, 2).toLowerCase();

          return matchesName || matchesShortCode;
        });

  const totalAccumulated = records.reduce((sum, r) => sum + r.netYield, 0);
  const totalTaxWithheld = records.reduce((sum, r) => sum + r.isrWithheld, 0);

  const handleExportCSV = () => {
    const headers = ['ID', 'Banco', 'Fecha', 'Hora', 'Rendimiento Bruto', 'ISR Retenido', 'Rendimiento Neto', 'Saldo actual'];
    const rows = filteredRecords.map((r) => [
      r.id,
      r.bankName,
      r.date,
      r.time,
      r.grossYield.toFixed(2),
      r.isrWithheld.toFixed(2),
      r.netYield.toFixed(2),
      r.balanceAtTime.toFixed(2),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rendimax_historial_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* Summary Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#e2e8f0]/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col min-w-0">
          <span className="font-hanken text-[11px] sm:text-[12px] font-bold text-[#45464d] uppercase tracking-wider">
            Intereses Netos Acumulados Registrados
          </span>
          <span className="font-space text-[26px] sm:text-[32px] font-bold text-[#006c49] leading-tight">
            {formatMXN(totalAccumulated, { showSign: true })} MXN
          </span>
          <span className="font-hanken text-[12px] text-[#76777d] mt-0.5">
            Retención total SAT registrada: <span className="font-medium text-slate-700">-{formatMXN(totalTaxWithheld)}</span>
          </span>
        </div>

        <button
          onClick={handleExportCSV}
          className="self-start sm:self-center px-4 py-2.5 bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] rounded-xl font-hanken text-[13px] font-semibold flex items-center gap-2 transition-all border border-[#dce9ff] shadow-xs active:scale-95 shrink-0"
          type="button"
          title="Descargar reporte completo en formato CSV / Excel"
        >
          <span className="material-symbols-outlined text-[19px] text-[#006c49]">
            download
          </span>
          <span>Exportar Historial</span>
        </button>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar flex-wrap sm:flex-nowrap">
        {filterOptions.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setSelectedFilter(opt.id)}
            className={`px-3.5 py-1.5 rounded-full font-hanken text-[12px] shrink-0 transition-all ${
              selectedFilter === opt.id
                ? 'bg-[#0b1c30] text-white font-semibold shadow-xs'
                : 'bg-white text-[#45464d] hover:bg-slate-100 border border-[#e2e8f0]/80'
            }`}
            type="button"
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Transactions Feed - Responsive 2-column on md/lg desktop */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="font-hanken text-[12px] font-bold text-[#45464d] uppercase tracking-wider">
            Abonos Registrados ({filteredRecords.length})
          </span>
          <span className="font-hanken text-[11px] text-[#76777d]">
            Orden cronológico más reciente
          </span>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl border border-dashed border-[#cbd5e1] text-center text-[#76777d] font-hanken text-[14px]">
            No hay registros para este filtro seleccionado.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredRecords.map((rec) => (
              <div
                key={rec.id}
                className="bg-white p-4 rounded-xl border border-[#e2e8f0]/80 shadow-xs flex items-center justify-between gap-3 transition-all hover:border-[#006c49]/40 hover:shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-10 h-10 rounded-full ${rec.badgeBg} ${rec.badgeText} flex items-center justify-center font-space text-[13px] font-bold shrink-0`}
                  >
                    {rec.shortCode}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-hanken font-semibold text-[13px] sm:text-[14px] text-[#0b1c30] truncate">
                      {rec.bankName}
                    </span>
                    <span className="font-hanken text-[11px] text-[#76777d] truncate">
                      {rec.date} • {rec.time}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0 pl-2">
                  <span className="font-space text-[15px] sm:text-[16px] font-bold text-[#006c49] whitespace-nowrap">
                    {formatMXN(rec.netYield, { showSign: true })}
                  </span>
                  <span className="font-hanken text-[10px] text-[#76777d] whitespace-nowrap">
                    Bruto ${rec.grossYield.toFixed(2)} | SAT -${rec.isrWithheld.toFixed(2)}
                  </span>
                  <span className="font-hanken text-[10px] text-[#45464d] whitespace-nowrap">
                    Saldo actual: {formatMXN(rec.balanceAtTime)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
