// ============================================================
//  FINFLOW — Google Apps Script Backend v2
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

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.entries(SHEET_NAME_CONFIG).forEach(([key, cfg]) => {
    let sheet = ss.getSheetByName(cfg.name);
    if (!sheet) {
      sheet = ss.insertSheet(cfg.name);
      const headers = HEADERS[key];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground(cfg.color)
        .setFontColor('#ffffff')
        .setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(1, 80);
      sheet.setColumnWidth(3, 220);
    }
  });
  return { ok: true, message: 'Planilha configurada com sucesso!' };
}

function genId(prefix) {
  return prefix.toUpperCase() + Date.now().toString(36).toUpperCase();
}

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
      if (v instanceof Date) {
        obj[h] = isNaN(v.getTime()) ? '' : Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else {
        obj[h] = v;
      }
    });
    return obj;
  });
  return { ok: true, headers, rows };
}

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
      headers.forEach((h, j) => {
        if (newData[h] !== undefined) sheet.getRange(i + 1, j + 1).setValue(newData[h]);
      });
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
    if (String(data[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Registro não encontrado' };
}

function getSummary() {
  const tipos = ['saidas','entradas','parcelas','assinaturas'];
  const summary = {};
  const now = new Date();
  const mes = now.getMonth();
  const ano = now.getFullYear();

  tipos.forEach(tipo => {
    const result = getRows(tipo);
    if (!result.ok) { summary[tipo] = { total: 0, mes: 0, count: 0 }; return; }
    const rows = result.rows;
    let total = 0, totalMes = 0;

    rows.forEach(row => {
      const valRaw = row['Valor'] || row['Valor Parcela'] || 0;
      const val = parseFloat(String(valRaw).replace(',','.')) || 0;
      total += val;

      // Parcelas e assinaturas: soma todas as ativas
      if (tipo === 'parcelas' || tipo === 'assinaturas') {
        const status = String(row['Status'] || '').toLowerCase();
        if (status === 'ativo' || status === '') totalMes += val;
        return;
      }

      // Saídas e entradas: filtra pelo mês atual
      const dateRaw = row['Data'] || '';
      if (dateRaw) {
        try {
          const d = (dateRaw instanceof Date) ? dateRaw : new Date(dateRaw);
          if (!isNaN(d.getTime()) && d.getMonth() === mes && d.getFullYear() === ano) {
            totalMes += val;
          }
        } catch(e) {}
      }
    });

    summary[tipo] = { total, mes: totalMes, count: rows.length };
  });

  // Saídas por mês para o gráfico — inclui crédito parcelado
  const saidasResult = getRows('saidas');
  const porMes = {};
  if (saidasResult.ok) {
    saidasResult.rows.forEach(row => {
      try {
        const d = new Date(row['Data']);
        if (isNaN(d.getTime())) return;
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const val = parseFloat(String(row['Valor']).replace(',','.')) || 0;
        porMes[key] = (porMes[key] || 0) + val;
      } catch(e) {}
    });
  }

  // Resumo por forma de pagamento (saídas do mês)
  const porForma = {};
  if (saidasResult.ok) {
    saidasResult.rows.forEach(row => {
      try {
        const d = new Date(row['Data']);
        if (isNaN(d.getTime())) return;
        if (d.getMonth() !== mes || d.getFullYear() !== ano) return;
        const forma = row['Forma Pagamento'] || 'Outro';
        const val = parseFloat(String(row['Valor']).replace(',','.')) || 0;
        porForma[forma] = (porForma[forma] || 0) + val;
      } catch(e) {}
    });
  }

  return { ok: true, summary, porMes, porForma };
}

// ══════════════════════════════════════════════════════════════
//  VIRADA DE MÊS — roda automaticamente todo dia 1º às 6h
// ══════════════════════════════════════════════════════════════

// Chame esta função UMA VEZ manualmente para registrar o trigger:
//   No Apps Script → Executar → registrarTriggerMensal
function registrarTriggerMensal() {
  // Remove triggers antigos desta função para não duplicar
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'viradaDeMes') ScriptApp.deleteTrigger(t);
  });
  // Cria trigger: todo dia 1º do mês, entre 6h e 7h
  ScriptApp.newTrigger('viradaDeMes')
    .timeBased()
    .onMonthDay(1)
    .atHour(6)
    .create();
  Logger.log('Trigger mensal registrado com sucesso!');
}

// Função principal — executada automaticamente no dia 1º
function viradaDeMes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone();
  const hoje = new Date();
  const log = [];

  // ── 1. PARCELAS: avança parcela atual, quita se chegou ao fim ──
  const sheetParcelas = ss.getSheetByName('Parcelas');
  if (sheetParcelas) {
    const data = sheetParcelas.getDataRange().getValues();
    const h = data[0];
    const iStatus     = h.indexOf('Status');
    const iParcAtual  = h.indexOf('Parcela Atual');
    const iTotalParc  = h.indexOf('Total Parcelas');
    const iProxVenc   = h.indexOf('Próximo Vencimento');

    for (let i = 1; i < data.length; i++) {
      const status = String(data[i][iStatus] || '').toLowerCase();
      if (status !== 'ativo') continue;

      const parcAtual = parseInt(data[i][iParcAtual]) || 1;
      const totalParc = parseInt(data[i][iTotalParc]) || 1;
      const novaParc  = parcAtual + 1;

      if (novaParc > totalParc) {
        // Última parcela foi paga — quita
        sheetParcelas.getRange(i + 1, iStatus + 1).setValue('Quitado');
        log.push(`Parcela quitada: ${data[i][h.indexOf('Descrição')]}`);
      } else {
        // Avança parcela atual
        sheetParcelas.getRange(i + 1, iParcAtual + 1).setValue(novaParc);

        // Atualiza próximo vencimento (+1 mês)
        if (iProxVenc >= 0 && data[i][iProxVenc]) {
          const venc = new Date(data[i][iProxVenc]);
          if (!isNaN(venc.getTime())) {
            venc.setMonth(venc.getMonth() + 1);
            sheetParcelas.getRange(i + 1, iProxVenc + 1)
              .setValue(Utilities.formatDate(venc, tz, 'yyyy-MM-dd'));
          }
        }
        log.push(`Parcela avançada: ${data[i][h.indexOf('Descrição')]} → ${novaParc}/${totalParc}`);
      }
    }
  }

  // ── 2. ASSINATURAS: avança próximo vencimento conforme o ciclo ──
  const sheetAssins = ss.getSheetByName('Assinaturas');
  if (sheetAssins) {
    const data = sheetAssins.getDataRange().getValues();
    const h = data[0];
    const iStatus   = h.indexOf('Status');
    const iCiclo    = h.indexOf('Ciclo');
    const iProxVenc = h.indexOf('Próximo Vencimento');

    for (let i = 1; i < data.length; i++) {
      const status = String(data[i][iStatus] || '').toLowerCase();
      if (status !== 'ativo') continue;
      if (iProxVenc < 0 || !data[i][iProxVenc]) continue;

      const venc = new Date(data[i][iProxVenc]);
      if (isNaN(venc.getTime())) continue;

      const ciclo = String(data[i][iCiclo] || 'Mensal').toLowerCase();
      const novaData = new Date(venc);

      if (ciclo === 'mensal')       novaData.setMonth(novaData.getMonth() + 1);
      else if (ciclo === 'anual')   novaData.setFullYear(novaData.getFullYear() + 1);
      else if (ciclo === 'trimestral') novaData.setMonth(novaData.getMonth() + 3);
      else if (ciclo === 'semanal') novaData.setDate(novaData.getDate() + 7);
      else                          novaData.setMonth(novaData.getMonth() + 1);

      sheetAssins.getRange(i + 1, iProxVenc + 1)
        .setValue(Utilities.formatDate(novaData, tz, 'yyyy-MM-dd'));

      log.push(`Assinatura atualizada: ${data[i][h.indexOf('Serviço')]} → vence ${Utilities.formatDate(novaData, tz, 'dd/MM/yyyy')}`);
    }
  }

  // ── 3. Registra log na aba Dashboard ──────────────────────────
  const dash = ss.getSheetByName('Dashboard');
  if (dash) {
    const dataHoje = Utilities.formatDate(hoje, tz, 'dd/MM/yyyy HH:mm');
    dash.getRange('A3').setValue(`Última virada de mês: ${dataHoje}`);
    dash.getRange('A4').setValue(`Parcelas atualizadas: ${log.filter(l=>l.includes('Parcela')).length}`);
    dash.getRange('A5').setValue(`Assinaturas atualizadas: ${log.filter(l=>l.includes('Assinatura')).length}`);
    if (log.length > 0) {
      dash.getRange('A7').setValue('Log da última execução:');
      log.forEach((entry, idx) => dash.getRange(8 + idx, 1).setValue('• ' + entry));
    }
  }

  Logger.log('Virada de mês concluída:\n' + log.join('\n'));
  return { ok: true, atualizados: log.length, log };
}

// Permite chamar viradaDeMes manualmente via API (para testar)
// GET ?action=virada
function _runVirada() {
  return viradaDeMes();
}

function doGet(e) {
  const action   = e.parameter.action   || '';
  const tipo     = e.parameter.tipo     || '';
  const callback = e.parameter.callback || '';

  let result;
  if      (action === 'setup')   result = setupSheets();
  else if (action === 'get')     result = getRows(tipo);
  else if (action === 'summary') result = getSummary();
  else if (action === 'virada')  result = _runVirada();
  else result = { ok: false, error: 'Ação desconhecida.' };

  const json = JSON.stringify(result);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch(err) { return _json({ ok: false, error: 'JSON inválido' }); }
  const { action, tipo, data, id } = body;
  let result;
  if      (action === 'add')    result = addRow(tipo, data);
  else if (action === 'update') result = updateRow(tipo, id, data);
  else if (action === 'delete') result = deleteRow(tipo, id);
  else result = { ok: false, error: 'Ação desconhecida.' };
  return _json(result);
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}