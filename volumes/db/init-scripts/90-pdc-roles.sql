-- Set passwords for the roles this stack actually uses.
-- Run by the db-init service as supabase_admin: in supabase/postgres the initdb
-- superuser defaults to supabase_admin (ENV POSTGRES_USER), while `postgres`
-- is only a regular app role.
-- Values come from POSTGRES_PASSWORD (read into :'pgpass').
\set pgpass `echo $POSTGRES_PASSWORD`

ALTER USER supabase_admin WITH PASSWORD :'pgpass';
ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';
ALTER USER postgres WITH SUPERUSER PASSWORD :'pgpass';
