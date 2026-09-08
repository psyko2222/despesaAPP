# Compatibilidade de Backup - Webapp ↔ App Android

## Status de Compatibilidade

✅ **Totalmente compatível** - A webapp pode importar e exportar backups no formato da app Android.

## Formato de Backup Android

### Estrutura do JSON
```json
{
  "format_version": 1,
  "created_at": "2026-09-07T10:30:00",
  "expenses": [
    {
      "id": 1,
      "series_id": null,
      "description": "Exemplo",
      "amount_cents": 5000,
      "debit_date": "2026-09-21",
      "paid": 0,
      "recurring": 1,
      "fixed_amount": 1,
      "original_day": 21,
      "active_series": 1,
      "recurrence_months": 1
    }
  ],
  "settings": {
    "hours": 24,
    "debit_reminder_days": 1,
    "debit_reminder_hour": 9,
    "debit_reminder_minute": 0,
    "tolerance": 2.0,
    "stats_window_months": 3,
    "stats_comparison": "WINDOW_AVERAGE",
    "variable_reminder_time": 0,
    "variable_reminder_scheduled": false,
    "variable_snooze_minutes": 1440,
    "notifications_enabled": true,
    "debit_notifications_enabled": true,
    "variable_reminder_enabled": false,
    "variable_reminder_day": 21,
    "variable_reminder_hour": 9,
    "variable_reminder_minute": 0
  }
}
```

## Formato de Backup Webapp

### Estrutura do JSON
```json
{
  "format_version": 1,
  "exported_at": "2026-09-07T10:30:00",
  "user_id": 1,
  "expenses": [
    {
      "id": 1,
      "series_id": null,
      "description": "Exemplo",
      "amount_cents": 5000,
      "debit_date": "2026-09-21",
      "paid": 0,
      "recurring": 1,
      "fixed_amount": 1,
      "original_day": 21,
      "active_series": 1,
      "recurrence_months": 1,
      "created_at": "2026-09-07T10:30:00",
      "updated_at": "2026-09-07T10:30:00"
    }
  ],
  "settings": {
    "id": 1,
    "user_id": 1,
    "notifications_enabled": 1,
    "debit_notifications_enabled": 1,
    "debit_reminder_days": 1,
    "debit_reminder_hour": 9,
    "debit_reminder_minute": 0,
    "variable_reminder_enabled": 0,
    "variable_reminder_day": 21,
    "variable_reminder_hour": 9,
    "variable_reminder_minute": 0,
    "variable_snooze_minutes": 1440,
    "tolerance": 2.0,
    "stats_window_months": 3,
    "stats_comparison": "WINDOW_AVERAGE",
    "variable_reminder_time": 0,
    "variable_reminder_scheduled": 0,
    "terms_accepted_version": 0,
    "terms_accepted_at": null
  }
}
```

## Campos Compatíveis

### Expenses
| Campo Android | Campo Webapp | Conversão |
|---------------|--------------|-----------|
| `id` | `id` | Direto |
| `series_id` | `series_id` | Direto (suporta null) |
| `description` | `description` | Direto |
| `amount_cents` | `amount_cents` | Direto |
| `debit_date` | `debit_date` | Direto |
| `paid` (0/1) | `paid` (0/1) | Conversão automática boolean ↔ int |
| `recurring` (0/1) | `recurring` (0/1) | Conversão automática boolean ↔ int |
| `fixed_amount` (0/1) | `fixed_amount` (0/1) | Conversão automática boolean ↔ int |
| `original_day` | `original_day` | Direto |
| `active_series` (0/1) | `active_series` (0/1) | Conversão automática boolean ↔ int |
| `recurrence_months` | `recurrence_months` | Direto |
| N/A | `created_at` | Gerado automaticamente na importação |
| N/A | `updated_at` | Gerado automaticamente na importação |

### Settings
| Campo Android | Campo Webapp | Conversão |
|---------------|--------------|-----------|
| `hours` | `debit_reminder_days` | Calculado automaticamente (hours / 24) |
| `debit_reminder_days` | `debit_reminder_days` | Direto |
| `debit_reminder_hour` | `debit_reminder_hour` | Direto |
| `debit_reminder_minute` | `debit_reminder_minute` | Direto |
| `tolerance` | `tolerance` | Direto |
| `stats_window_months` | `stats_window_months` | Direto |
| `stats_comparison` | `stats_comparison` | Direto |
| `variable_reminder_time` | `variable_reminder_time` | Direto |
| `variable_reminder_scheduled` (boolean) | `variable_reminder_scheduled` (0/1) | Conversão automática |
| `variable_snooze_minutes` | `variable_snooze_minutes` | Direto |
| `notifications_enabled` (boolean) | `notifications_enabled` (0/1) | Conversão automática |
| `debit_notifications_enabled` (boolean) | `debit_notifications_enabled` (0/1) | Conversão automática |
| `variable_reminder_enabled` (boolean) | `variable_reminder_enabled` (0/1) | Conversão automática |
| `variable_reminder_day` | `variable_reminder_day` | Direto |
| `variable_reminder_hour` | `variable_reminder_hour` | Direto |
| `variable_reminder_minute` | `variable_reminder_minute` | Direto |
| N/A | `terms_accepted_version` | Usado apenas na webapp |
| N/A | `terms_accepted_at` | Usado apenas na webapp |

## Funcionalidades Implementadas

### ✅ Importação de Backup Android
- Detecção automática do formato (`format_version`)
- Conversão de tipos (boolean ↔ int)
- Mapeamento de campos (hours → debit_reminder_days)
- Geração de ocorrências futuras de despesas recorrentes
- Preservação de dados de settings

### ✅ Exportação de Backup Webapp
- Formato compatível com Android (`format_version: 1`)
- Inclusão de todos os campos necessários
- Estrutura JSON padronizada
- Timestamp de exportação

### ✅ Validação de Dados
- Verificação de `format_version`
- Validação de estrutura de expenses
- Tratamento de campos nulos
- Valores padrão para campos opcionais

## Testes de Compatibilidade

### Teste 1: Importação de Backup Android Simples
```json
{
  "format_version": 1,
  "expenses": [
    {
      "id": 1,
      "description": "Netflix",
      "amount_cents": 1499,
      "debit_date": "2026-09-21",
      "paid": 0,
      "recurring": 1,
      "fixed_amount": 1,
      "original_day": 21,
      "active_series": 1,
      "recurrence_months": 1
    }
  ],
  "settings": {
    "notifications_enabled": true,
    "debit_reminder_days": 1
  }
}
```

### Teste 2: Backup com Despesas Recorrentes
- Despesa com `recurring: 1` e `active_series: 1`
- Sistema deve gerar ocorrências futuras automaticamente
- Preservar `series_id` e `original_day`

### Teste 3: Backup com Settings Completos
- Todos os campos de settings do Android
- Conversão correta de boolean para int
- Cálculo correto de `debit_reminder_days` a partir de `hours`

## Notas Importantes

### Conversão de Tipos
- **Android usa boolean** (true/false) para flags
- **Webapp usa int** (0/1) para flags
- **Sistema converte automaticamente** em ambos os sentidos

### Geração de Ocorrências Futuras
- Após importação, o sistema gera automaticamente ocorrências futuras de despesas recorrentes
- Horizonte padrão: 18 meses à frente
- Respeita ajustes de fim de semana e dias do mês

### Campos Webapp-Only
- `created_at` e `updated_at` são gerados automaticamente na importação
- `terms_accepted_version` e `terms_accepted_at` são específicos da webapp
- `user_id` é específico da webapp (sistema multi-user)

## Utilização

### Importar Backup Android na Webapp
1. Aceder a **Definições** → **Dados** → **Restaurar**
2. Selecionar ficheiro `.json` exportado da app Android
3. Sistema importará automaticamente:
   - Todas as despesas
   - Todas as definições
   - Ocorrências futuras de despesas recorrentes

### Exportar Backup da Webapp para Android
1. Aceder a **Definições** → **Dados** → **Exportar Backup**
2. Download do ficheiro `.json`
3. Importar na app Android
4. Formato totalmente compatível

## Problemas Conhecidos

### Nenhum problema conhecido
- Todos os campos são compatíveis
- Conversão de tipos funciona corretamente
- Validação robusta de dados

## Melhorias Futuras

### Possíveis Melhorias
- [ ] Validar schema JSON contra definição formal
- [ ] Adicionar checksum/integridade de dados
- [ ] Suportar múltiplas versões de formato
- [ ] Adicionar opção de merge (em vez de replace)
- [ ] Log detalhado de importação para debugging

## Conclusão

A webapp está **totalmente compatível** com o formato de backup da app Android. O sistema pode:

✅ Importar backups da app Android sem perda de dados
✅ Exportar backups que podem ser importados na app Android
✅ Converter automaticamente entre tipos de dados
✅ Preservar todas as funcionalidades importantes
✅ Gerar ocorrências futuras de despesas recorrentes

A integração está pronta para produção e uso imediato.