alter table escape_logs add column if not exists reason text not null default 'emergency';
