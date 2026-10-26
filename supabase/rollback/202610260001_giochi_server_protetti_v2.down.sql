-- BLOCCO 1B-2 rollback draft. Use only on an isolated database after quiescing
-- the v2 writer/worker; restores the latest private game state to the legacy row.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.partite_gioco_push_outbox_v2
    WHERE stato IN ('pending', 'claimed', 'uncertain')
  ) THEN
    RAISE EXCEPTION 'Drain or reconcile multiplayer push outbox before rollback';
  END IF;
END;
$$;

UPDATE public.partite_gioco p
SET stato_partita = s.stato_completo,
    updated_at = now()
FROM public.partite_gioco_stati_privati_v2 s
WHERE s.partita_id = p.id;

GRANT SELECT ON TABLE public.partite_gioco TO authenticated;
GRANT EXECUTE ON FUNCTION public.crea_sfida_gioco(text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rispondi_sfida_gioco(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.annulla_sfida_gioco(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salva_stato_partita_gioco(uuid,integer,jsonb,uuid,boolean,uuid) TO authenticated;

DROP FUNCTION public.accoda_push_gioco_v2(uuid,text,integer,uuid,uuid);
DROP FUNCTION public.risultato_partita_gioco_v2(uuid);
DROP FUNCTION public.valida_mossa_partita_gioco_v2(uuid,integer,text,text[]);
DROP FUNCTION public.annulla_sfida_gioco_v2(uuid);
DROP FUNCTION public.rispondi_sfida_gioco_v2(uuid,boolean);
DROP FUNCTION public.crea_sfida_gioco_v2(text,uuid);
DROP FUNCTION public.inizializza_stato_partita_gioco_v2(uuid,jsonb);
DROP FUNCTION public.elenco_partite_gioco_v2();
DROP FUNCTION public.rilascia_presenza_partita_gioco_v2(uuid,uuid);
DROP FUNCTION public.heartbeat_partita_gioco_v2(uuid,uuid,text,boolean,integer);
DROP FUNCTION public.leggi_partita_gioco_v2(uuid);
DROP TABLE public.partite_gioco_push_consegne_v2;
DROP TABLE public.partite_gioco_push_outbox_v2;
DROP TABLE public.partite_gioco_operazioni_v2;
DROP TABLE public.partite_gioco_presenze_v2;
DROP TABLE public.partite_gioco_stati_privati_v2;

COMMIT;
