-- Campo esplicito: non deduce mai come retribuito il vuoto tra due turni.
alter table public.turni
  add column if not exists minuti_aggiuntivi_retribuiti integer not null default 0;

alter table public.turni
  drop constraint if exists turni_minuti_aggiuntivi_retribuiti_check;

alter table public.turni
  add constraint turni_minuti_aggiuntivi_retribuiti_check
  check (minuti_aggiuntivi_retribuiti between 0 and 1440);

-- La tabella deve consentire più righe nella stessa data. Rimuove soltanto
-- un eventuale vincolo UNIQUE composto esattamente da utente e data,
-- indipendentemente dal nome assegnato nel database remoto.
do $$
declare
  vincolo record;
  colonne smallint[];
begin
  select array_agg(attnum order by attnum)::smallint[]
    into colonne
  from pg_attribute
  where attrelid = 'public.turni'::regclass
    and attname in ('user_id', 'anno', 'mese', 'giorno')
    and not attisdropped;

  if cardinality(colonne) = 4 then
    for vincolo in
      select conname
      from pg_constraint
      where conrelid = 'public.turni'::regclass
        and contype = 'u'
        and (
          select array_agg(x order by x)::smallint[]
          from unnest(conkey) as x
        ) = colonne
    loop
      execute format(
        'alter table public.turni drop constraint %I',
        vincolo.conname
      );
    end loop;
  end if;
end $$;

create index if not exists turni_user_data_idx
  on public.turni (user_id, anno, mese, giorno, inizio);
