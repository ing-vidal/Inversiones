import React, { useState } from 'react';
import { BankAccount, DailyYieldRecord } from '../../types/finance';
import { calculateTermProgress, formatMXN } from '../../utils/calculator';

import { BankInstitution } from '../../types/finance';

interface HistorialViewProps {
  records: DailyYieldRecord[];
  accounts: BankAccount[];
  institutions?: BankInstitution[];
}

export const HistorialView: React.FC<HistorialViewProps> = ({ records, accounts, institutions = [] }) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'month' | 'year' | 'all'>('all');

  const filterOptions: { id: string; label: string; accountId?: string }[] = [
    { id: 'all', label: 'Todos los bancos' },
    ...accounts.map((account) => ({
      id: `account:${account.id}`,
      label: `${account.institutionName} - ${account.paymentFrequency === 'vencimiento' ? 'Plazo fijo' : 'Diario'}`,
      accountId: account.id,
    })),
  ];

  const selectedFilterOption = filterOptions.find((option) => option.id === selectedFilter);

  const getRecordDate = (record: DailyYieldRecord) => {
    if (record.createdAt) return new Date(record.createdAt);
    if (record.date.toLowerCase().startsWith('hoy')) return new Date();
    return null;
  };

  const isInSelectedPeriod = (record: DailyYieldRecord) => {
    if (selectedPeriod === 'all') return true;
    const recordDate = getRecordDate(record);
    if (!recordDate) return false;

    const now = new Date();
    if (selectedPeriod === 'day') {
      return recordDate.toDateString() === now.toDateString();
    }
    if (selectedPeriod === 'month') {
      return recordDate.getFullYear() === now.getFullYear() && recordDate.getMonth() === now.getMonth();
    }
    return recordDate.getFullYear() === now.getFullYear();
  };

  const filteredRecords = records.filter((record) => {
    const matchesInstitution = (() => {
      if (selectedFilter === 'all') return true;
      return selectedFilterOption?.accountId === record.accountId;
    })();

    return matchesInstitution && isInSelectedPeriod(record);
  });

  const termAccounts = accounts.filter((account) =>
    account.paymentFrequency === 'vencimiento'
    && (selectedFilter === 'all' || selectedFilterOption?.accountId === account.id)
  );

  const totalAccumulated = filteredRecords.reduce((sum, r) => sum + r.netYield, 0);
  const totalTaxWithheld = filteredRecords.reduce((sum, r) => sum + r.isrWithheld, 0);

  const csvEscape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

  const handleExportCSV = () => {
    const headers = ['ID', 'Banco', 'Fecha', 'Hora', 'Rendimiento Bruto', 'ISR Retenido', 'Rendimiento Neto', 'Saldo actual'];
    const rows = filteredRecords.map((r) => [
      csvEscape(r.id),
      csvEscape(r.bankName),
      csvEscape(r.date),
      csvEscape(r.time),
      csvEscape(r.grossYield.toFixed(2)),
      csvEscape(r.isrWithheld.toFixed(2)),
      csvEscape(r.netYield.toFixed(2)),
      csvEscape(r.balanceAtTime.toFixed(2)),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' +
      [headers.map(csvEscape).join(','), ...rows.map((row) => row.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rendimax_historial_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) return;

    const periodLabel = selectedPeriod === 'day'
      ? 'Día actual'
      : selectedPeriod === 'month'
      ? 'Mes actual'
      : selectedPeriod === 'year'
      ? 'Año actual'
      : 'Desde el principio';
    const bankLabel = selectedFilterOption?.label ?? 'Todos los bancos';
    const escapeHtml = (value: string) => value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    printWindow.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Rendimax - Historial de abonos</title>
          <style>
            @page { size: A4; margin: 18mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #17233b; font: 12px Arial, sans-serif; }
            header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #00b981; padding-bottom: 14px; margin-bottom: 22px; }
            h1 { margin: 0; font-size: 24px; color: #0c1830; }
            .meta { color: #607089; text-align: right; line-height: 1.6; }
            .summary { display: flex; gap: 36px; margin-bottom: 18px; }
            .metric span { display: block; color: #607089; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
            .metric strong { display: block; margin-top: 4px; color: #00a879; font-size: 18px; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #0d2036; color: white; padding: 9px 7px; text-align: left; font-size: 10px; }
            td { border-bottom: 1px solid #dce5ed; padding: 8px 7px; }
            td.amount { color: #009b70; font-weight: 700; text-align: right; }
            td.number { text-align: right; }
            footer { margin-top: 18px; color: #718096; font-size: 10px; }
          </style>
        </head>
        <body>
          <header>
            <div><h1>Rendimax</h1><div>Historial de abonos</div></div>
            <div class="meta">Banco: ${escapeHtml(bankLabel)}<br />Periodo: ${periodLabel}</div>
          </header>
          <section class="summary">
            <div class="metric"><span>Rendimiento neto</span><strong>${formatMXN(totalAccumulated, { showSign: true })} MXN</strong></div>
            <div class="metric"><span>ISR retenido</span><strong>-${formatMXN(totalTaxWithheld)} MXN</strong></div>
            <div class="metric"><span>Registros</span><strong>${filteredRecords.length}</strong></div>
          </section>
          <table>
            <thead><tr><th>Banco</th><th>Fecha</th><th>Hora</th><th>Bruto</th><th>ISR</th><th>Neto</th><th>Saldo actual</th></tr></thead>
            <tbody>
              ${filteredRecords.map((record) => `
                <tr>
                  <td>${escapeHtml(record.bankName)}</td>
                  <td>${escapeHtml(record.date)}</td>
                  <td>${escapeHtml(record.time)}</td>
                  <td class="number">$${record.grossYield.toFixed(2)}</td>
                  <td class="number">-$${record.isrWithheld.toFixed(2)}</td>
                  <td class="amount">${formatMXN(record.netYield, { showSign: true })}</td>
                  <td class="number">${formatMXN(record.balanceAtTime)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
          <footer>Generado por Rendimax el ${new Date().toLocaleString('es-MX')}</footer>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onafterprint = () => printWindow.close();
    printWindow.onload = () => printWindow.print();
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

        <div className="flex flex-wrap gap-2 self-start sm:self-center">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] rounded-xl font-hanken text-[13px] font-semibold flex items-center gap-2 transition-all border border-[#dce9ff] shadow-xs active:scale-95"
            type="button"
            title="Descargar historial en CSV"
          >
            <span className="material-symbols-outlined text-[19px] text-[#006c49]">download</span>
            <span>CSV</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="px-3.5 py-2.5 bg-[#006c49] hover:bg-[#005a3c] text-white rounded-xl font-hanken text-[13px] font-semibold flex items-center gap-2 transition-all shadow-xs active:scale-95"
            type="button"
            title="Abrir historial para guardar como PDF"
          >
            <span className="material-symbols-outlined text-[19px]">picture_as_pdf</span>
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Filter controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
        <label className="flex flex-col gap-1.5 font-hanken text-[11px] font-bold uppercase tracking-wider text-[#45464d]">
          Institución
          <select
            value={selectedFilter}
            onChange={(event) => setSelectedFilter(event.target.value)}
            className="w-full bg-[#eff4ff] border border-[#dce9ff] rounded-xl px-3.5 py-3 text-[13px] font-hanken font-semibold text-[#0b1c30] outline-none"
          >
            {filterOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 font-hanken text-[11px] font-bold uppercase tracking-wider text-[#45464d]">
          Periodo
          <select
            value={selectedPeriod}
            onChange={(event) => setSelectedPeriod(event.target.value as typeof selectedPeriod)}
            className="w-full bg-[#eff4ff] border border-[#dce9ff] rounded-xl px-3.5 py-3 text-[13px] font-hanken font-semibold text-[#0b1c30] outline-none"
          >
            <option value="day">Día actual</option>
            <option value="month">Mes actual</option>
            <option value="year">Año actual</option>
            <option value="all">Desde el principio</option>
          </select>
        </label>
      </div>

      {/* Transactions Feed - Responsive 2-column on md/lg desktop */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="font-hanken text-[12px] font-bold text-[#45464d] uppercase tracking-wider">
            Abonos Registrados ({filteredRecords.length + termAccounts.length})
          </span>
          <span className="font-hanken text-[11px] text-[#76777d]">
            Orden cronológico más reciente
          </span>
        </div>

        {filteredRecords.length === 0 && termAccounts.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl border border-dashed border-[#cbd5e1] text-center text-[#76777d] font-hanken text-[14px]">
            No hay registros para este filtro seleccionado.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {termAccounts.map((account) => {
              const termProgress = calculateTermProgress({
                balance: account.balance,
                nominalRate: account.nominalRate,
                base: account.baseDivisor,
                startDate: account.startDate,
                endDate: account.endDate,
              });
              const maturityDate = account.endDate
                ? new Date(`${account.endDate}T00:00:00`).toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
                : 'Fecha de vencimiento pendiente';

              return (
                <div
                  key={`term-${account.id}`}
                  className="bg-white p-4 rounded-xl border border-[#e2e8f0]/80 shadow-xs flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-full ${account.badgeBg} ${account.badgeText} flex items-center justify-center font-space text-[13px] font-bold shrink-0`}>
                      {account.shortCode}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-hanken font-semibold text-[13px] sm:text-[14px] text-[#0b1c30] truncate">
                        {account.institutionName}
                      </span>
                      <span className="font-hanken text-[11px] text-[#76777d] truncate">
                        Plazo fijo • Vence: {maturityDate}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0 pl-2">
                    <span className="font-space text-[15px] sm:text-[16px] font-bold text-[#006c49] whitespace-nowrap">
                      {formatMXN(termProgress.maturityAmount)}
                    </span>
                    <span className="font-hanken text-[10px] text-[#76777d] whitespace-nowrap">
                      Monto al vencimiento
                    </span>
                    <span className="font-hanken text-[10px] text-[#006c49] whitespace-nowrap">
                      Ganado a la fecha: {formatMXN(termProgress.accruedInterest)}
                    </span>
                    <span className="font-hanken text-[10px] text-[#45464d] whitespace-nowrap">
                      Saldo invertido: {formatMXN(account.balance)}
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredRecords.map((rec) => {
              const isMifelRecord = rec.bankName.toLowerCase().includes('mifel');
              return (
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
                  {isMifelRecord ? (
                    <>
                      <span className="font-space text-[15px] sm:text-[16px] font-bold text-[#006c49] whitespace-nowrap">
                        Intereses {formatMXN(rec.grossYield, { showSign: true })}
                      </span>
                      <span className="font-hanken text-[10px] text-[#b4534b] whitespace-nowrap">
                        ISR retenido: -${rec.isrWithheld.toFixed(2)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-space text-[15px] sm:text-[16px] font-bold text-[#006c49] whitespace-nowrap">
                        {formatMXN(rec.netYield, { showSign: true })}
                      </span>
                      <span className="font-hanken text-[10px] text-[#76777d] whitespace-nowrap">
                        Bruto ${rec.grossYield.toFixed(2)} | SAT -${rec.isrWithheld.toFixed(2)}
                      </span>
                    </>
                  )}
                  <span className="font-hanken text-[10px] text-[#45464d] whitespace-nowrap">
                    Saldo actual: {formatMXN(rec.balanceAtTime)}
                  </span>
                </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
