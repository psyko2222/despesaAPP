import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Expense } from '@/types';
import { formatMoney, formatDate, recurrenceLabel } from '@/lib/utils';

export interface MonthlyReportData {
  periodDisplay: string;
  monthKey: string;
  expenses: Expense[];
  userEmail?: string;
}

export interface RecurringReportData {
  expenses: Expense[];
  userEmail?: string;
}

/**
 * Exporta o extrato do mês/período financeiro em formato PDF.
 */
export function exportMonthlyReportPdf(data: MonthlyReportData) {
  const { periodDisplay, monthKey, expenses, userEmail } = data;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Cálculos de Totais
  const totalCents = expenses.reduce((sum, e) => sum + (e.amount_cents || 0), 0);
  const paidCents = expenses.filter(e => e.paid === 1).reduce((sum, e) => sum + (e.amount_cents || 0), 0);
  const pendingCents = totalCents - paidCents;
  const paidCount = expenses.filter(e => e.paid === 1).length;
  const totalCount = expenses.length;
  const percentPaid = totalCents > 0 ? Math.round((paidCents / totalCents) * 100) : 0;

  // 2. Cabeçalho
  doc.setFillColor(37, 99, 235); // primary-600 #2563eb
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('EXTRATO DE DESPESAS', 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Período: ${periodDisplay}`, 14, 21);

  const emitDate = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  doc.setFontSize(9);
  doc.text(`Emitido em: ${emitDate}`, pageWidth - 14, 13, { align: 'right' });
  if (userEmail) {
    doc.text(`Conta: ${userEmail}`, pageWidth - 14, 21, { align: 'right' });
  }

  // 3. Bloco de Resumo (Cards)
  let yPos = 35;
  const cardWidth = (pageWidth - 28 - 8) / 3;
  const cardHeight = 18;

  // Card Total
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(14, yPos, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('TOTAL DO PERÍODO', 18, yPos + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(formatMoney(totalCents), 18, yPos + 13);

  // Card Pago
  const card2X = 14 + cardWidth + 4;
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.roundedRect(card2X, yPos, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text(`PAGO (${paidCount}/${totalCount} - ${percentPaid}%)`, card2X + 4, yPos + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(6, 95, 70); // emerald-800
  doc.text(formatMoney(paidCents), card2X + 4, yPos + 13);

  // Card Pendente
  const card3X = card2X + cardWidth + 4;
  doc.setFillColor(254, 242, 242); // rose-50
  doc.roundedRect(card3X, yPos, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(225, 29, 72); // rose-600
  doc.text('PENDENTE', card3X + 4, yPos + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(159, 18, 57); // rose-800
  doc.text(formatMoney(pendingCents), card3X + 4, yPos + 13);

  // 4. Tabela de Despesas
  const sortedExpenses = [...expenses].sort((a, b) => a.debit_date.localeCompare(b.debit_date));

  const tableBody = sortedExpenses.map((exp) => {
    const isPaid = exp.paid === 1;
    const isFixed = exp.fixed_amount === 1;
    const isRec = exp.recurring === 1;

    let tipoStr = 'Pontual';
    if (isRec) {
      tipoStr = isFixed ? 'Fixa' : 'Variável';
    }

    return [
      formatDate(exp.debit_date),
      exp.description,
      tipoStr,
      isPaid ? 'Pago' : 'Pendente',
      formatMoney(exp.amount_cents || 0),
    ];
  });

  autoTable(doc, {
    startY: yPos + cardHeight + 6,
    head: [['Data', 'Descrição', 'Tipo', 'Estado', 'Valor (€)']],
    body: tableBody,
    theme: 'striped',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    styles: {
      fontSize: 9,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 26, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 24, halign: 'center' },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      // Destaque colorido para a coluna de Estado
      if (data.section === 'body' && data.column.index === 3) {
        if (data.cell.raw === 'Pago') {
          data.cell.styles.textColor = [5, 150, 105];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [225, 29, 72];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    foot: [
      ['', 'Total', '', `${paidCount}/${totalCount} pagas`, formatMoney(totalCents)],
    ],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 9,
    },
    margin: { left: 14, right: 14, bottom: 15 },
    didDrawPage: (data) => {
      // Rodapé em cada página
      const pageNum = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `Despesas - Documento confidencial • Página ${pageNum}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      );
    },
  });

  const safePeriod = monthKey.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`extrato-despesas-${safePeriod}.pdf`);
}

/**
 * Exporta o relatório completo de todas as despesas recorrentes registadas.
 */
export function exportRecurringExpensesPdf(data: RecurringReportData) {
  const { expenses, userEmail } = data;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Filtrar apenas despesas recorrentes distintas (uma por série)
  const seriesMap = new Map<number, Expense>();
  for (const exp of expenses) {
    if (exp.recurring === 1) {
      const key = exp.series_id || exp.id;
      // Guardar uma ocorrência de referência para cada série
      if (!seriesMap.has(key) || (exp.id === exp.series_id)) {
        seriesMap.set(key, exp);
      }
    }
  }

  const distinctRecurring = Array.from(seriesMap.values());

  // Ordenar por Periodicidade (Mensal, etc.) e depois por Dia de Débito
  distinctRecurring.sort((a, b) => {
    if (a.recurrence_months !== b.recurrence_months) {
      return a.recurrence_months - b.recurrence_months;
    }
    return (a.original_day || 0) - (b.original_day || 0);
  });

  // Cálculos de impacto mensal e anual estimado
  let totalMonthlyCommitmentCents = 0;
  let totalAnnualCommitmentCents = 0;
  let fixedCount = 0;
  let variableCount = 0;

  for (const exp of distinctRecurring) {
    const isFixed = exp.fixed_amount === 1;
    const amount = exp.amount_cents || 0;
    const recMonths = exp.recurrence_months || 1;

    if (isFixed) {
      fixedCount++;
      const monthlyEquiv = (amount / recMonths);
      const annualEquiv = (amount * (12 / recMonths));
      totalMonthlyCommitmentCents += monthlyEquiv;
      totalAnnualCommitmentCents += annualEquiv;
    } else {
      variableCount++;
    }
  }

  // 1. Cabeçalho
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text('DESPESAS REGULARES & RECORRENTES', 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Dossiê de Contratos e Compromissos Periódicos`, 14, 21);

  const emitDate = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  doc.setFontSize(9);
  doc.text(`Emitido em: ${emitDate}`, pageWidth - 14, 13, { align: 'right' });
  if (userEmail) {
    doc.text(`Conta: ${userEmail}`, pageWidth - 14, 21, { align: 'right' });
  }

  // 2. Bloco de Resumo (Cards)
  let yPos = 35;
  const cardWidth = (pageWidth - 28 - 8) / 3;
  const cardHeight = 18;

  // Card 1: Quantidade
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, yPos, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL DE CONTRATOS', 18, yPos + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${distinctRecurring.length} (${fixedCount} fixas, ${variableCount} var.)`, 18, yPos + 13);

  // Card 2: Compromisso Mensal Fixo
  const card2X = 14 + cardWidth + 4;
  doc.setFillColor(238, 242, 255); // indigo-50
  doc.roundedRect(card2X, yPos, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(79, 70, 229); // indigo-600
  doc.text('COMPROMISSO MENSAL FIXO', card2X + 4, yPos + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(49, 46, 129); // indigo-900
  doc.text(formatMoney(Math.round(totalMonthlyCommitmentCents)) + '/mês', card2X + 4, yPos + 13);

  // Card 3: Encargo Anual Fixo
  const card3X = card2X + cardWidth + 4;
  doc.setFillColor(243, 232, 255); // purple-50
  doc.roundedRect(card3X, yPos, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(147, 51, 234); // purple-600
  doc.text('ENCARGO ANUAL ESTIMADO', card3X + 4, yPos + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(88, 28, 135); // purple-900
  doc.text(formatMoney(Math.round(totalAnnualCommitmentCents)) + '/ano', card3X + 4, yPos + 13);

  // 3. Tabela de Despesas Recorrentes
  const tableBody = distinctRecurring.map((exp) => {
    const isFixed = exp.fixed_amount === 1;
    const recMonths = exp.recurrence_months || 1;
    const amount = exp.amount_cents || 0;
    const annualEst = isFixed ? (amount * (12 / recMonths)) : 0;

    return [
      exp.description,
      `Dia ${exp.original_day || '-'}`,
      recurrenceLabel(recMonths),
      isFixed ? 'Valor Fixo' : 'Variável',
      isFixed ? formatMoney(amount) : 'Variável',
      isFixed ? formatMoney(Math.round(annualEst)) : '—',
    ];
  });

  autoTable(doc, {
    startY: yPos + cardHeight + 6,
    head: [['Descrição', 'Dia Débito', 'Periodicidade', 'Tipo', 'Valor Base (€)', 'Anual Estimado (€)']],
    body: tableBody,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    styles: {
      fontSize: 9,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 'auto', fontStyle: 'bold' },
      1: { cellWidth: 24, halign: 'center' },
      2: { cellWidth: 26, halign: 'center' },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
    },
    foot: [
      ['Total', '', `${distinctRecurring.length} despesas`, '', '', formatMoney(Math.round(totalAnnualCommitmentCents))],
    ],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 9,
    },
    margin: { left: 14, right: 14, bottom: 15 },
    didDrawPage: (data) => {
      const pageNum = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Despesas - Relatório de Recorrências • Página ${pageNum}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      );
    },
  });

  doc.save('despesas-regulares-recorrentes.pdf');
}
