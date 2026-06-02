// Supabase Edge Function: daily-agenda
// Endpoint de DIGEST: monta a agenda (dia/semana/mês) de TODOS os consultores
// e devolve { subject, html, text, recipients } PRONTO para o n8n enviar por e-mail.
// Esta função NÃO envia e-mail — quem agenda e envia é o n8n.
//
// Segurança: protegida por token no header `x-agenda-token` (deploy com verify_jwt=false).
//   Secret necessário: AGENDA_TRIGGER_TOKEN  (defina um valor aleatório e use o mesmo no n8n)
//   SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no runtime.
//
// Body (POST, opcional):
//   period:     "day" (padrão) | "week" | "month"
//   date:       data base ISO (padrão: hoje)
//   recipients: string[] (padrão: andrei@futuree.org, lucas@ativaconsultoria.net.br)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Period = 'day' | 'week' | 'month';

const DEFAULT_RECIPIENTS = ['andrei@futuree.org', 'lucas@ativaconsultoria.net.br'];
const HIDDEN = ['andreimagagna@gmail.com', 'andrei@futuree.org'];

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const br = (isoDate: string) => new Date(isoDate + 'T00:00:00').toLocaleDateString('pt-BR');

function rangeFor(period: Period, base: Date): { start: string; end: string; label: string } {
  const d = new Date(base);
  if (period === 'day') {
    return { start: iso(d), end: iso(d), label: `do dia ${d.toLocaleDateString('pt-BR')}` };
  }
  if (period === 'week') {
    const day = (d.getDay() + 6) % 7; // segunda = 0
    const start = new Date(d); start.setDate(d.getDate() - day);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return { start: iso(start), end: iso(end), label: `da semana (${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')})` };
  }
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: iso(start), end: iso(end), label: `do mês de ${start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}` };
}

type Linha = { consultor: string; date: string; projeto: string; os: string | null; manager: string | null };

function buildHtml(label: string, porConsultor: Map<string, Linha[]>): string {
  let blocos = '';
  for (const [consultor, linhas] of porConsultor) {
    const rows = linhas.map(l => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eef;">${br(l.date)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eef;">${l.projeto}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eef;">${l.os ?? '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eef;">${l.manager ?? '—'}</td>
      </tr>`).join('');
    blocos += `
      <h3 style="margin:20px 0 6px;color:#0f172a;">${consultor}</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#f1f5f9;text-align:left;">
          <th style="padding:6px 10px;">Data</th><th style="padding:6px 10px;">Projeto</th>
          <th style="padding:6px 10px;">OS</th><th style="padding:6px 10px;">Gerente</th>
        </tr></thead><tbody>${rows}</tbody></table>`;
  }
  if (!blocos) blocos = '<p style="color:#64748b;">Nenhuma agenda no período.</p>';

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#1e293b;">
    <h2 style="color:#2563eb;">Agenda ${label}</h2>
    ${blocos}
    <p style="color:#94a3b8;font-size:12px;margin-top:24px;">Enviado automaticamente por Agendas Ativa.</p>
  </div>`;
}

function buildText(label: string, porConsultor: Map<string, Linha[]>): string {
  let out = `Agenda ${label}\n`;
  if (porConsultor.size === 0) return out + 'Nenhuma agenda no período.';
  for (const [consultor, linhas] of porConsultor) {
    out += `\n${consultor}:\n`;
    out += linhas.map(l => `  • ${br(l.date)} — ${l.projeto}${l.os ? ` (OS ${l.os})` : ''}${l.manager ? ` — ${l.manager}` : ''}`).join('\n') + '\n';
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    // --- Auth por token ---
    const expected = Deno.env.get('AGENDA_TRIGGER_TOKEN');
    const got = req.headers.get('x-agenda-token');
    if (!expected || got !== expected) {
      return new Response(JSON.stringify({ error: 'Não autorizado. Configure AGENDA_TRIGGER_TOKEN e envie o header x-agenda-token.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const period: Period = (body.period as Period) || 'day';
    const base = body.date ? new Date(body.date) : new Date();
    const recipients: string[] = Array.isArray(body.recipients) && body.recipients.length ? body.recipients : DEFAULT_RECIPIENTS;
    const { start, end, label } = rangeFor(period, base);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const [{ data: consultores }, { data: projetos }, { data: allocs }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email').in('role', ['CONSULTOR', 'GERENTE']),
      supabase.from('projects').select('id, name'),
      supabase.from('allocations').select('consultant_id, project_id, date, os, manager').gte('date', start).lte('date', end).order('date'),
    ]);

    const projName = new Map((projetos || []).map((p: any) => [p.id, p.name]));
    const consById = new Map((consultores || [])
      .filter((c: any) => !HIDDEN.includes((c.email || '').toLowerCase()))
      .map((c: any) => [c.id, c.full_name]));

    const porConsultor = new Map<string, Linha[]>();
    for (const a of (allocs || [])) {
      const nome = consById.get(a.consultant_id);
      if (!nome) continue; // pula contas ocultas/admin
      const linha: Linha = { consultor: nome, date: a.date, projeto: projName.get(a.project_id) || '—', os: a.os, manager: a.manager };
      if (!porConsultor.has(nome)) porConsultor.set(nome, []);
      porConsultor.get(nome)!.push(linha);
    }
    // ordena por nome
    const ordenado = new Map([...porConsultor.entries()].sort((a, b) => a[0].localeCompare(b[0])));

    const totalItens = [...ordenado.values()].reduce((s, l) => s + l.length, 0);

    return new Response(JSON.stringify({
      subject: `Agenda ${label}`,
      html: buildHtml(label, ordenado),
      text: buildText(label, ordenado),
      recipients,
      period, start, end,
      consultores: ordenado.size,
      itens: totalItens,
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
