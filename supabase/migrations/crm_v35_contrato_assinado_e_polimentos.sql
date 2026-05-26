-- ════════════════════════════════════════════════════════════════════
--  CRM v35 — Contrato assinado, flags de aluguel, anexos extras
--
--  1. Upload do contrato assinado (depois do João assinar via ZapSign/Gov):
--     pdf_assinado_url, pdf_assinado_path, assinado_em
--
--  2. Flags de pacote financeiro:
--     aluguel_inclui_iptu, aluguel_inclui_condominio
--     (não mudam texto sozinhas — habilitam cláusulas adicionais novas)
--
--  3. Anexos extras (PDFs avulsos que vão ao final do contrato):
--     anexos_extras_paths TEXT[]
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE contrato_geracoes
  ADD COLUMN IF NOT EXISTS aluguel_inclui_iptu        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS aluguel_inclui_condominio  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pdf_assinado_url           TEXT,
  ADD COLUMN IF NOT EXISTS pdf_assinado_path          TEXT,
  ADD COLUMN IF NOT EXISTS assinado_em                TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anexos_extras_paths        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

COMMENT ON COLUMN contrato_geracoes.aluguel_inclui_iptu IS
  'Quando true, sugere incluir a cláusula adicional "IPTU incluso no aluguel" no contrato.';
COMMENT ON COLUMN contrato_geracoes.aluguel_inclui_condominio IS
  'Quando true, sugere incluir a cláusula adicional "Condomínio incluso no aluguel".';
COMMENT ON COLUMN contrato_geracoes.pdf_assinado_url IS
  'URL pública do PDF assinado (upload após assinatura no ZapSign/Gov).';
COMMENT ON COLUMN contrato_geracoes.pdf_assinado_path IS
  'Path no bucket pra delete/atualização.';
COMMENT ON COLUMN contrato_geracoes.assinado_em IS
  'Data/hora em que o contrato assinado foi anexado.';
COMMENT ON COLUMN contrato_geracoes.anexos_extras_paths IS
  'Paths no bucket de PDFs avulsos anexados ao contrato (RG, comprovantes, etc.).';

NOTIFY pgrst, 'reload schema';
