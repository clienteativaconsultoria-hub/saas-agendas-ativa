# Envio diário de agendas — via n8n

Arquitetura: **n8n agenda e envia**; a Edge Function `daily-agenda` apenas **devolve a agenda do dia pronta** (assunto + HTML + texto). Destinatários atuais: `andrei@futuree.org` e `lucas@ativaconsultoria.net.br`.

```
[n8n Schedule 07h] --> [HTTP POST -> Edge Function] --> [n8n Send Email -> Andrei + Lucas]
```

## 1. Definir o secret do token (obrigatório)
A função fica em 401 até existir o secret `AGENDA_TRIGGER_TOKEN`. Gere um valor aleatório (ex.: `openssl rand -hex 24`) e use o **mesmo** valor aqui e no header do n8n. **Nunca** versione o token real neste arquivo.

Defina no Supabase → **Project Settings → Edge Functions → Secrets** (ou CLI):
```bash
supabase secrets set AGENDA_TRIGGER_TOKEN="<SEU_AGENDA_TRIGGER_TOKEN>"
```
> `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem no runtime. A função **não** precisa de chave de e-mail (quem envia é o n8n).

## 2. Testar a função (depois do secret)
```bash
curl -X POST "https://kcijdanyqwavgsqtlqyj.supabase.co/functions/v1/daily-agenda" \
  -H "x-agenda-token: <SEU_AGENDA_TRIGGER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"period":"day"}'
```
Retorna `{ subject, html, text, recipients, itens, consultores }`.
Parâmetros opcionais no body: `period` = `day|week|month`, `date` (ISO), `recipients` (array p/ sobrescrever os padrões).

## 3. Workflows no n8n (já provisionados)
Em produção (https://n8n.futuree.org) há **3 workflows ativos**, todos com o mesmo padrão
`Schedule → HTTP POST (Edge Function, header x-agenda-token) → Gmail` e a credencial **Gmail OAuth**
(não SMTP). Destinatários default vêm da própria função (`andrei@futuree.org`, `lucas@ativaconsultoria.net.br`).
Horários **escalonados** pra não empilhar e-mails:

| Workflow | Cron | period |
|---|---|---|
| Agenda Mensal Ativa - Dia 1 às 5h | `0 5 1 * *` | month |
| Agenda Semanal Ativa - Segunda 6h | `0 6 * * 1` | week |
| Agenda Diária Ativa - Envio 7h (seg-sex) | `0 7 * * 1-5` | day |

O `n8n-workflow.json` nesta pasta é a referência de import manual (SMTP genérico); a montagem real foi
feita via MCP usando o nó Gmail. Pra recriar manualmente: importe, troque o placeholder do token no header
e configure a credencial de envio.

## 5. WhatsApp (futuro)
Mesmo padrão: o n8n usa o `text` do retorno e envia pelo nó de WhatsApp (Business API/Twilio/Evolution).
A função já devolve `text` pronto para isso.
```
