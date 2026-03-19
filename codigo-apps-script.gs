// ============================================================
//  FINFLOW — Google Apps Script Backend v3
// ============================================================

const SHEET_NAME_CONFIG = {
  saidas:      { name: 'Saídas',      color: '#FF6B6B' },
  entradas:    { name: 'Entradas',    color: '#51CF66' },
  parcelas:    { name: 'Parcelas',    color: '#CC5DE8' },
  assinaturas: { name: 'Assinaturas', color: '#FF922B' },
};

const HEADERS = {
  saidas:      ['ID','Data','Descrição','Categoria','Valor','Forma Pagamento','Cartão','Parcelas','Parcela Atual','Observação'],
  entradas:    ['ID','Data','Descrição','Fonte','Valor','Recorrente','Observação'],
  parcelas:    ['ID','Descrição','Valor Total','Valor Parcela','Total Parcelas','Parcela Atual','Cartão','Data Início','Próximo Vencimento','Categoria','Status'],
  assinaturas: ['ID','Serviço','Valor','Ciclo','Cartão','Próximo Vencimento','Categoria','Status','Observação'],
};

// ── SETUP ──────────────────────────────────────────────────
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.entries(SHEET_NAME_CONFIG).forEach(([key, cfg]) => {
    let sheet = ss.getSheetByName(cfg.name);
    if (!sheet) {
      sheet = ss.insertSheet(cfg.name);
      const headers = HEADERS[key];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground(cfg.color).setFontColor('#ffffff').setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(1, 80);
      sheet.setColumnWidth(3, 220);
    }
  });

  // Aba Metas (nova)
  if (!ss.getSheetByName('Metas')) {
    const m = ss.insertSheet('Metas');
    const mh = ['Categoria','Meta Mensal (R$)'];
    m.getRange(1,1,1,2).setValues([mh])
      .setBackground('#6c5ce7').setFontColor('#fff').setFontWeight('bold');
    m.setFrozenRows(1);
    // Categorias padrão
    const cats = [['Alimentação',800],['Transporte',300],['Saúde',200],['Lazer',400],['Casa',500],['Vestuário',200],['Educação',300],['Outros',200]];
    m.getRange(2,1,cats.length,2).setValues(cats);
  }

  return { ok: true, message: 'Planilha configurada com sucesso!' };
}

function genId(prefix) {
  return prefix.toUpperCase() + Date.now().toString(36).toUpperCase();
}

// ── GET ROWS ───────────────────────────────────────────────
function getRows(tipo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = SHEET_NAME_CONFIG[tipo];
  if (!cfg) return { ok: false, error: 'Tipo inválido' };
  const sheet = ss.getSheetByName(cfg.name);
  if (!sheet) return { ok: false, error: 'Aba não encontrada.' };
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { ok: true, headers: data[0] || [], rows: [] };
  const headers = data[0];
  const rows = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      const v = row[i];
      if (v instanceof Date) obj[h] = isNaN(v.getTime()) ? '' : Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      else obj[h] = v;
    });
    return obj;
  });
  return { ok: true, headers, rows };
}

// ── GET METAS ──────────────────────────────────────────────
function getMetas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Metas');
  if (!sheet) return { ok: false, error: 'Aba Metas não encontrada. Execute setupSheets.' };
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { ok: true, metas: [] };
  const metas = data.slice(1).map(row => ({ categoria: row[0], meta: parseFloat(row[1]) || 0 }));
  return { ok: true, metas };
}

// ── SAVE METAS ─────────────────────────────────────────────
function saveMetas(metas) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Metas');
  if (!sheet) { setupSheets(); sheet = ss.getSheetByName('Metas'); }
  // Limpa dados existentes (mantém header)
  const last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, 2).clearContent();
  if (metas.length > 0) {
    const rows = metas.map(m => [m.categoria, parseFloat(m.meta) || 0]);
    sheet.getRange(2, 1, rows.length, 2).setValues(rows);
  }
  return { ok: true };
}

// ── ADD / UPDATE / DELETE ──────────────────────────────────
function addRow(tipo, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = SHEET_NAME_CONFIG[tipo];
  if (!cfg) return { ok: false, error: 'Tipo inválido' };
  const sheet = ss.getSheetByName(cfg.name);
  if (!sheet) return { ok: false, error: 'Aba não encontrada.' };
  const headers = HEADERS[tipo];
  data['ID'] = genId(tipo[0]);
  const row = headers.map(h => data[h] !== undefined ? data[h] : '');
  sheet.appendRow(row);
  return { ok: true, id: data['ID'] };
}

function updateRow(tipo, id, newData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = SHEET_NAME_CONFIG[tipo];
  if (!cfg) return { ok: false, error: 'Tipo inválido' };
  const sheet = ss.getSheetByName(cfg.name);
  if (!sheet) return { ok: false, error: 'Aba não encontrada.' };
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('ID');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      headers.forEach((h, j) => { if (newData[h] !== undefined) sheet.getRange(i+1,j+1).setValue(newData[h]); });
      return { ok: true };
    }
  }
  return { ok: false, error: 'Registro não encontrado' };
}

function deleteRow(tipo, id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = SHEET_NAME_CONFIG[tipo];
  if (!cfg) return { ok: false, error: 'Tipo inválido' };
  const sheet = ss.getSheetByName(cfg.name);
  if (!sheet) return { ok: false, error: 'Aba não encontrada.' };
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('ID');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) { sheet.deleteRow(i+1); return { ok: true }; }
  }
  return { ok: false, error: 'Registro não encontrado' };
}

// ── SUMMARY ────────────────────────────────────────────────
function getSummary(mesParam, anoParam) {
  const now = new Date();
  const mes = mesParam !== undefined ? parseInt(mesParam) : now.getMonth();
  const ano = anoParam !== undefined ? parseInt(anoParam) : now.getFullYear();
  const tipos = ['saidas','entradas','parcelas','assinaturas'];
  const summary = {};

  tipos.forEach(tipo => {
    const result = getRows(tipo);
    if (!result.ok) { summary[tipo] = { total: 0, mes: 0, count: 0 }; return; }
    let total = 0, totalMes = 0;
    result.rows.forEach(row => {
      const val = parseFloat(String(row['Valor'] || row['Valor Parcela'] || 0).replace(',','.')) || 0;
      total += val;
      if (tipo === 'parcelas' || tipo === 'assinaturas') {
        const status = String(row['Status'] || '').toLowerCase();
        if (status !== 'ativo' && status !== '') return;
        const temCartao = String(row['Cartão'] || '').trim() !== '';
        if (!temCartao) totalMes += val;
        return;
      }
      const dateRaw = row['Data'] || '';
      if (dateRaw) {
        try {
          const d = new Date(dateRaw);
          if (!isNaN(d.getTime()) && d.getMonth() === mes && d.getFullYear() === ano) totalMes += val;
        } catch(e) {}
      }
    });
    summary[tipo] = { total, mes: totalMes, count: result.rows.length };
  });

  // Saídas por mês (gráfico)
  const saidasResult = getRows('saidas');
  const porMes = {};
  const porForma = {};
  const porCategoria = {};

  if (saidasResult.ok) {
    saidasResult.rows.forEach(row => {
      try {
        const d = new Date(row['Data']);
        if (isNaN(d.getTime())) return;
        const val = parseFloat(String(row['Valor']).replace(',','.')) || 0;
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        porMes[key] = (porMes[key] || 0) + val;
        if (d.getMonth() === mes && d.getFullYear() === ano) {
          const forma = row['Forma Pagamento'] || 'Outro';
          porForma[forma] = (porForma[forma] || 0) + val;
          const cat = row['Categoria'] || 'Outros';
          porCategoria[cat] = (porCategoria[cat] || 0) + val;
        }
      } catch(e) {}
    });
  }

  return { ok: true, summary, porMes, porForma, porCategoria, mes, ano };
}

// ── VIRADA DE MÊS ─────────────────────────────────────────
function registrarTriggerMensal() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'viradaDeMes') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('viradaDeMes').timeBased().onMonthDay(1).atHour(6).create();
  Logger.log('Trigger mensal registrado!');
}

function viradaDeMes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone();
  const hoje = new Date();
  const log = [];

  // Mês anterior (para o relatório)
  const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const mesNome = mesAnterior.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // 1. Avança parcelas
  const sheetP = ss.getSheetByName('Parcelas');
  if (sheetP) {
    const data = sheetP.getDataRange().getValues();
    const h = data[0];
    const iStatus = h.indexOf('Status'), iParcAtual = h.indexOf('Parcela Atual');
    const iTotalParc = h.indexOf('Total Parcelas'), iProxVenc = h.indexOf('Próximo Vencimento');
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][iStatus]||'').toLowerCase() !== 'ativo') continue;
      const parcAtual = parseInt(data[i][iParcAtual]) || 1;
      const totalParc = parseInt(data[i][iTotalParc]) || 1;
      const novaParc = parcAtual + 1;
      if (novaParc > totalParc) {
        sheetP.getRange(i+1, iStatus+1).setValue('Quitado');
        log.push(`✓ Quitada: ${data[i][h.indexOf('Descrição')]}`);
      } else {
        sheetP.getRange(i+1, iParcAtual+1).setValue(novaParc);
        if (iProxVenc >= 0 && data[i][iProxVenc]) {
          const v = new Date(data[i][iProxVenc]);
          if (!isNaN(v.getTime())) { v.setMonth(v.getMonth()+1); sheetP.getRange(i+1,iProxVenc+1).setValue(Utilities.formatDate(v,tz,'yyyy-MM-dd')); }
        }
        log.push(`→ Parcela: ${data[i][h.indexOf('Descrição')]} ${novaParc}/${totalParc}`);
      }
    }
  }

  // 2. Avança assinaturas
  const sheetA = ss.getSheetByName('Assinaturas');
  if (sheetA) {
    const data = sheetA.getDataRange().getValues();
    const h = data[0];
    const iStatus = h.indexOf('Status'), iCiclo = h.indexOf('Ciclo'), iProxVenc = h.indexOf('Próximo Vencimento');
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][iStatus]||'').toLowerCase() !== 'ativo') continue;
      if (iProxVenc < 0 || !data[i][iProxVenc]) continue;
      const venc = new Date(data[i][iProxVenc]);
      if (isNaN(venc.getTime())) continue;
      const ciclo = String(data[i][iCiclo]||'Mensal').toLowerCase();
      const nova = new Date(venc);
      if (ciclo==='mensal') nova.setMonth(nova.getMonth()+1);
      else if (ciclo==='anual') nova.setFullYear(nova.getFullYear()+1);
      else if (ciclo==='trimestral') nova.setMonth(nova.getMonth()+3);
      else if (ciclo==='semanal') nova.setDate(nova.getDate()+7);
      else nova.setMonth(nova.getMonth()+1);
      sheetA.getRange(i+1,iProxVenc+1).setValue(Utilities.formatDate(nova,tz,'yyyy-MM-dd'));
      log.push(`↻ Assinatura: ${data[i][h.indexOf('Serviço')]} → ${Utilities.formatDate(nova,tz,'dd/MM/yyyy')}`);
    }
  }

  // 3. Envia relatório por e-mail
  enviarRelatorioMensal(mesAnterior.getMonth(), mesAnterior.getFullYear(), mesNome);

  // 4. Log no Dashboard
  const dash = ss.getSheetByName('Dashboard');
  if (dash) {
    dash.getRange('A3').setValue(`Última virada: ${Utilities.formatDate(hoje,tz,'dd/MM/yyyy HH:mm')}`);
    dash.getRange('A4').setValue(`Itens atualizados: ${log.length}`);
    log.forEach((entry, idx) => dash.getRange(6+idx, 1).setValue(entry));
  }

  Logger.log('Virada concluída:\n' + log.join('\n'));
  return { ok: true, log };
}

// ── RELATÓRIO MENSAL POR E-MAIL ────────────────────────────
// Chame registrarTriggerMensal() uma vez para ativar o envio automático.
// Para testar manualmente: Executar → enviarRelatorioMensal
function enviarRelatorioMensal(mes, ano, mesNome) {
  const now = new Date();
  if (mes === undefined) {
    const anterior = new Date(now.getFullYear(), now.getMonth()-1, 1);
    mes = anterior.getMonth();
    ano = anterior.getFullYear();
    mesNome = anterior.toLocaleDateString('pt-BR', { month:'long', year:'numeric' });
  }

  const sum = getSummary(mes, ano);
  if (!sum.ok) return;

  const s = sum.summary;
  const fmt = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const saldo = (s.entradas?.mes||0) - (s.saidas?.mes||0) - (s.parcelas?.mes||0) - (s.assinaturas?.mes||0);

  // Categorias com mais gastos
  const catsSorted = Object.entries(sum.porCategoria||{}).sort((a,b)=>b[1]-a[1]);
  const catsHtml = catsSorted.map(([cat,val]) =>
    `<tr><td style="padding:6px 12px;color:#444">${cat}</td><td style="padding:6px 12px;text-align:right;color:#c0392b;font-weight:500">${fmt(val)}</td></tr>`
  ).join('');

  const html = `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#f5f2ec;padding:32px 16px">
    <div style="background:#2c2a26;border-radius:12px 12px 0 0;padding:24px 28px">
      <div style="font-size:22px;color:#fff;font-weight:300;letter-spacing:-0.5px">Fin<span style="color:rgba(255,255,255,.4);font-style:italic">flow</span></div>
      <div style="font-size:13px;color:rgba(255,255,255,.4);margin-top:4px;text-transform:uppercase;letter-spacing:.6px">Relatório mensal</div>
    </div>
    <div style="background:#fffefb;border:1px solid #ddd9d0;border-top:none;border-radius:0 0 12px 12px;padding:28px">
      <div style="font-size:20px;color:#2c2a26;margin-bottom:20px;font-weight:400">
        Resumo de <strong>${mesNome}</strong>
      </div>

      <!-- KPIs -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">
        <div style="background:#f5f2ec;border-radius:8px;padding:14px;border-left:3px solid #c0392b">
          <div style="font-size:11px;color:#7a7670;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Saídas</div>
          <div style="font-size:22px;color:#c0392b;font-weight:500">${fmt(s.saidas?.mes)}</div>
          <div style="font-size:11px;color:#a8a49d;margin-top:3px">${s.saidas?.count||0} lançamentos</div>
        </div>
        <div style="background:#f5f2ec;border-radius:8px;padding:14px;border-left:3px solid #1a7a4a">
          <div style="font-size:11px;color:#7a7670;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Entradas</div>
          <div style="font-size:22px;color:#1a7a4a;font-weight:500">${fmt(s.entradas?.mes)}</div>
          <div style="font-size:11px;color:#a8a49d;margin-top:3px">${s.entradas?.count||0} lançamentos</div>
        </div>
        <div style="background:#f5f2ec;border-radius:8px;padding:14px;border-left:3px solid #6a1a8a">
          <div style="font-size:11px;color:#7a7670;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Parcelas</div>
          <div style="font-size:22px;color:#6a1a8a;font-weight:500">${fmt(s.parcelas?.mes)}</div>
          <div style="font-size:11px;color:#a8a49d;margin-top:3px">${s.parcelas?.count||0} ativas</div>
        </div>
        <div style="background:#f5f2ec;border-radius:8px;padding:14px;border-left:3px solid #a84a00">
          <div style="font-size:11px;color:#7a7670;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Assinaturas</div>
          <div style="font-size:22px;color:#a84a00;font-weight:500">${fmt(s.assinaturas?.mes)}</div>
          <div style="font-size:11px;color:#a8a49d;margin-top:3px">${s.assinaturas?.count||0} serviços</div>
        </div>
      </div>

      <!-- Saldo -->
      <div style="background:${saldo>=0?'rgba(26,122,74,.08)':'rgba(192,57,43,.08)'};border:1px solid ${saldo>=0?'rgba(26,122,74,.2)':'rgba(192,57,43,.2)'};border-radius:8px;padding:16px;margin-bottom:20px;text-align:center">
        <div style="font-size:11px;color:#7a7670;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Saldo estimado do mês</div>
        <div style="font-size:28px;font-weight:600;color:${saldo>=0?'#1a7a4a':'#c0392b'}">${fmt(saldo)}</div>
      </div>

      <!-- Gastos por categoria -->
      ${catsSorted.length > 0 ? `
      <div style="margin-bottom:8px;font-size:12px;color:#7a7670;text-transform:uppercase;letter-spacing:.5px;font-weight:500">Gastos por categoria</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;background:#f5f2ec;border-radius:8px;overflow:hidden">
        ${catsHtml}
      </table>` : ''}

      <div style="font-size:12px;color:#a8a49d;text-align:center;margin-top:8px">
        Gerado automaticamente pelo FinFlow · ${new Date().toLocaleDateString('pt-BR')}
      </div>
    </div>
  </div>`;

  const email = Session.getEffectiveUser().getEmail();
  GmailApp.sendEmail(email, `FinFlow — Relatório de ${mesNome}`, '', { htmlBody: html });
  Logger.log(`Relatório enviado para ${email}`);
}

function _runVirada() { return viradaDeMes(); }

// ── HTTP ENTRY POINTS ──────────────────────────────────────
function doGet(e) {
  const action   = e.parameter.action   || '';
  const tipo     = e.parameter.tipo     || '';
  const callback = e.parameter.callback || '';
  const mes      = e.parameter.mes;
  const ano      = e.parameter.ano;

  let result;
  if      (action === 'setup')    result = setupSheets();
  else if (action === 'get')      result = getRows(tipo);
  else if (action === 'summary')  result = getSummary(mes, ano);
  else if (action === 'metas')    result = getMetas();
  else if (action === 'virada')   result = _runVirada();
  else if (action === 'relatorio') { enviarRelatorioMensal(); result = { ok: true, msg: 'Relatório enviado!' }; }
  else result = { ok: false, error: 'Ação desconhecida.' };

  const json = JSON.stringify(result);
  if (callback) return ContentService.createTextOutput(callback+'('+json+')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch(err) { return _json({ ok: false, error: 'JSON inválido' }); }
  const { action, tipo, data, id, metas } = body;
  let result;
  if      (action === 'add')       result = addRow(tipo, data);
  else if (action === 'update')    result = updateRow(tipo, id, data);
  else if (action === 'delete')    result = deleteRow(tipo, id);
  else if (action === 'saveMetas') result = saveMetas(metas);
  else result = { ok: false, error: 'Ação desconhecida.' };
  return _json(result);
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ── CORREÇÃO DE HEADERS (utilitário) ──────────────────────
function corrigirHeadersAssinaturas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Assinaturas');
  if (!sheet) { Logger.log('Aba não encontrada'); return; }
  const headersCorretos = ['ID','Serviço','Valor','Ciclo','Cartão','Próximo Vencimento','Categoria','Status','Observação'];
  const atual = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  if (JSON.stringify(atual.slice(0,headersCorretos.length)) !== JSON.stringify(headersCorretos)) {
    sheet.getRange(1,1,1,headersCorretos.length).setValues([headersCorretos]);
    Logger.log('Headers corrigidos!');
  } else { Logger.log('Headers já corretos.'); }
}
