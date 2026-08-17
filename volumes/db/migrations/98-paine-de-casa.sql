-- Paine de Casa: schema + functii
-- Idempotent: poate fi rulat de mai multe ori (montat in initdb + rulat de db-init).

create extension if not exists pgcrypto;

create table if not exists public.breads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  weight_g int not null default 0,
  price numeric(10, 2) not null check (price >= 0),
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  phone text not null,
  address text not null,
  notes text not null default '',
  items jsonb not null default '[]'::jsonb,
  total numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  delivered_at timestamptz
);

-- pentru bazele deja initializate (create table if not exists nu ii modifica)
alter table public.orders add column if not exists accepted_at timestamptz;

create unique index if not exists orders_code_uq on public.orders (code);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_phone_idx on public.orders (phone);
create index if not exists orders_delivered_idx on public.orders (delivered_at desc);

create table if not exists public.app_config (
  key text primary key,
  value text
);

insert into public.app_config (key, value) values
  ('ordering_open', 'true'),
  ('banner', ''),
  ('baker_pin', lpad((100000 + floor(random() * 900000))::int::text, 6, '0'))
on conflict (key) do nothing;

alter table public.breads enable row level security;
alter table public.orders enable row level security;
alter table public.app_config enable row level security;

drop policy if exists "breads_public_read" on public.breads;
create policy "breads_public_read" on public.breads
  for select to anon
  using (active = true);

create or replace function public.gen_order_code()
returns text
language plpgsql
volatile
as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
begin
  for i in 1..6 loop
    code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return code;
end;
$$;

create or replace function public.place_order(
  p_name text,
  p_phone text,
  p_address text,
  p_notes text default '',
  p_items jsonb default '[]'::jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open text;
  v_item jsonb;
  v_bread_id uuid;
  v_qty int;
  v_bread record;
  v_total numeric(10, 2) := 0;
  v_items jsonb := '[]'::jsonb;
  v_order_id uuid;
  v_code text;
  v_phone text;
begin
  select value into v_open from app_config where key = 'ordering_open';
  if coalesce(v_open, 'true') <> 'true' then
    raise exception 'COMENZI_INCHISE: Comenzile nu sunt deschise momentan.';
  end if;

  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_phone), '') = '' or coalesce(trim(p_address), '') = '' then
    raise exception 'DATE_INCOMPLETE: Nume, telefon si adresa sunt obligatorii.';
  end if;

  v_phone := replace(p_phone, ' ', '');
  if length(v_phone) < 9 then
    raise exception 'TELEFON_INVALID: Numarul de telefon pare incomplet.';
  end if;

  if coalesce(jsonb_array_length(p_items), 0) = 0 then
    raise exception 'COMANDA_GOALA: Alege macar o paine.';
  end if;

  for v_item in select jsonb_array_elements(p_items)
  loop
    v_bread_id := (v_item ->> 'bread_id')::uuid;
    v_qty := coalesce((v_item ->> 'qty')::int, 0);
    if v_qty < 1 or v_qty > 99 then
      raise exception 'CANTITATE_INVALIDA: Cantitatile trebuie sa fie intre 1 si 99.';
    end if;
    select b.* into v_bread from breads b where b.id = v_bread_id and b.active = true;
    if not found then
      raise exception 'PAINE_SCHIMBATA: O paine din lista nu mai este disponibila. Actualizeaza pagina si reia comanda.';
    end if;
    v_total := v_total + v_bread.price * v_qty;
    v_items := v_items || jsonb_build_object(
      'bread_id', v_bread.id,
      'name', v_bread.name,
      'price', v_bread.price,
      'qty', v_qty,
      'row_total', v_bread.price * v_qty
    );
  end loop;

  loop
    v_code := gen_order_code();
    begin
      insert into orders (code, name, phone, address, notes, items, total)
      values (v_code, trim(p_name), v_phone, trim(p_address), coalesce(p_notes, ''), v_items, v_total)
      returning id into v_order_id;
      exit;
    exception
      when unique_violation then
        null;
    end;
  end loop;

  return jsonb_build_object('order_id', v_order_id, 'code', v_code)::json;
end;
$$;

create or replace function public.get_order_by_code(p_code text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'code', o.code,
    'name', o.name,
    'phone', o.phone,
    'address', o.address,
    'notes', o.notes,
    'items', o.items,
    'total', o.total,
    'created_at', o.created_at,
    'accepted_at', o.accepted_at,
    'delivered_at', o.delivered_at,
    'status', case
      when o.delivered_at is not null then 'delivered'
      when o.accepted_at is not null then 'accepted'
      else 'pending'
    end
  )::json
  from orders o
  where o.code = upper(trim(coalesce(p_code, '')));
$$;

create or replace function public.get_public_config()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'banner', nullif((select value from app_config where key = 'banner'), ''),
    'ordering_open', coalesce((select value from app_config where key = 'ordering_open'), 'true') = 'true'
  )::json;
$$;

create or replace function public.admin_get_all(p_pin text)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_pin text;
  v_banner text;
  v_open text;
begin
  select value into v_pin from app_config where key = 'baker_pin';
  if p_pin is null or p_pin <> v_pin then
    perform pg_sleep(1);
    raise exception 'PIN_GRESIT';
  end if;

  select value into v_banner from app_config where key = 'banner';
  select value into v_open from app_config where key = 'ordering_open';

  return (
    jsonb_build_object(
      'banner', nullif(v_banner, ''),
      'ordering_open', coalesce(v_open, 'true') = 'true',
      'production', (
        select coalesce(jsonb_object_agg(t.name, t.qty), '{}'::jsonb)
        from (
          select b.name as name, sum((i ->> 'qty')::int) as qty
          from orders o
          cross join jsonb_array_elements(o.items) i
          join breads b on b.id = (i ->> 'bread_id')::uuid
          where o.delivered_at is null
          group by b.name
        ) t
      ),
      'pending', (
        select coalesce(jsonb_agg(t), '[]'::jsonb)
        from (
          select o.code, o.name, o.phone, o.address, o.notes, o.items, o.total, o.created_at, o.accepted_at
          from orders o
          where o.delivered_at is null
          order by o.created_at asc
        ) t
      ),
      'delivered', (
        select coalesce(jsonb_agg(t), '[]'::jsonb)
        from (
          select o.code, o.total, o.created_at, o.delivered_at
          from orders o
          where o.delivered_at is not null
          order by o.delivered_at desc
          limit 10
        ) t
      ),
      'breads', (
        select coalesce(jsonb_agg(b order by b.created_at), '[]'::jsonb)
        from breads b
      )
    )::json
  );
end;
$$;

create or replace function public.mark_accepted(p_code text, p_pin text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_pin text;
begin
  select value into v_pin from app_config where key = 'baker_pin';
  if p_pin is null or p_pin <> v_pin then
    perform pg_sleep(1);
    raise exception 'PIN_GRESIT';
  end if;

  update orders
  set accepted_at = now()
  where code = upper(trim(coalesce(p_code, '')))
    and accepted_at is null
    and delivered_at is null;

  if not found then
    raise exception 'COMANDA_INEGASITA: Comanda nu mai este in asteptare.';
  end if;
end;
$$;

create or replace function public.mark_delivered(p_code text, p_pin text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_pin text;
begin
  select value into v_pin from app_config where key = 'baker_pin';
  if p_pin is null or p_pin <> v_pin then
    perform pg_sleep(1);
    raise exception 'PIN_GRESIT';
  end if;

  update orders
  set delivered_at = now()
  where code = upper(trim(coalesce(p_code, ''))) and delivered_at is null;

  if not found then
    raise exception 'COMANDA_INEGASITA: Nu exista nicio comanda in asteptare cu acest cod.';
  end if;
end;
$$;

create or replace function public.admin_search(p_pin text, p_phone text)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_pin text;
begin
  select value into v_pin from app_config where key = 'baker_pin';
  if p_pin is null or p_pin <> v_pin then
    perform pg_sleep(1);
    raise exception 'PIN_GRESIT';
  end if;

  return (
    select coalesce(jsonb_agg(t), '[]'::jsonb)
    from (
      select o.code, o.name, o.phone, o.address, o.notes, o.items, o.total, o.created_at, o.accepted_at, o.delivered_at
      from orders o
      where o.phone like '%' || coalesce(p_phone, '') || '%'
      order by o.created_at desc
      limit 20
    ) t
  )::json;
end;
$$;

create or replace function public.upsert_bread(
  p_pin text,
  p_id uuid default null,
  p_name text default null,
  p_description text default null,
  p_weight_g int default null,
  p_price numeric(10, 2) default null,
  p_photo_url text default null
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_pin text;
  v_b record;
begin
  select value into v_pin from app_config where key = 'baker_pin';
  if p_pin is null or p_pin <> v_pin then
    perform pg_sleep(1);
    raise exception 'PIN_GRESIT';
  end if;

  if p_id is null and coalesce(trim(p_name), '') = '' then
    raise exception 'NUME_RICA: Numele painii este obligatoriu.';
  end if;

  if p_id is null then
    insert into breads (name, description, weight_g, price, photo_url)
    values (
      trim(coalesce(p_name, '')),
      coalesce(p_description, ''),
      coalesce(p_weight_g, 0),
      coalesce(p_price, 0),
      nullif(p_photo_url, '')
    )
    returning * into v_b;
  else
    update breads
    set name = coalesce(trim(p_name), name),
        description = coalesce(p_description, description),
        weight_g = coalesce(p_weight_g, weight_g),
        price = coalesce(p_price, price),
        photo_url = coalesce(p_photo_url, photo_url)
    where id = p_id
    returning * into v_b;
    if not found then
      raise exception 'PAINE_INEXISTENTA';
    end if;
  end if;

  return to_jsonb(v_b)::json;
end;
$$;

create or replace function public.set_bread_active(p_pin text, p_id uuid, p_active boolean)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_pin text;
begin
  select value into v_pin from app_config where key = 'baker_pin';
  if p_pin is null or p_pin <> v_pin then
    perform pg_sleep(1);
    raise exception 'PIN_GRESIT';
  end if;

  update breads set active = p_active where id = p_id;
  if not found then
    raise exception 'PAINE_INEXISTENTA';
  end if;
end;
$$;

create or replace function public.set_config(
  p_pin text,
  p_banner text default null,
  p_ordering_open boolean default null,
  p_pin_new text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_pin text;
begin
  select value into v_pin from app_config where key = 'baker_pin';
  if p_pin is null or p_pin <> v_pin then
    perform pg_sleep(1);
    raise exception 'PIN_GRESIT';
  end if;

  if p_banner is not null then
    update app_config set value = p_banner where key = 'banner';
  end if;

  if p_ordering_open is not null then
    update app_config set value = p_ordering_open::text where key = 'ordering_open';
  end if;

  if p_pin_new is not null then
    if p_pin_new !~ '^[0-9]{6,12}$' then
      raise exception 'PIN_INVALID: PIN-ul nou trebuie sa aiba intre 6 si 12 cifre.';
    end if;
    update app_config set value = p_pin_new where key = 'baker_pin';
  end if;
end;
$$;
