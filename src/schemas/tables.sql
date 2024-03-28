create table songs (
  id uuid primary key default uuid_generate_v4(),
  song_id varchar not null,
  song_name varchar not null,
  alphabet varchar not null,
  version_num integer not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null,
  bpm text,

  unique (song_id)
);

create table charts (
  id uuid primary key default uuid_generate_v4(),
  song_id uuid not null references songs (id) on delete cascade,
  difficulty varchar not null,
  rating integer not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null,

  unique (song_id, difficulty)
);
create index charts_rating_idx on charts (rating);

create table scores (
  chart_id uuid not null references charts (id) on delete cascade,
  username varchar not null,
  score integer not null,
  lamp integer not null,

  unique (chart_id, username)
);
create index scores_chart_id_score_idx on scores (chart_id, score);

create table difficulties (
  chart_id uuid not null references charts (id) on delete cascade,
  score_cutoff integer,
  lamp_cutoff integer,
  difficulty numeric not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null
);
create unique index difficulties_chart_id_score_cutoff_lamp_cutoff_idx on difficulties (chart_id, score_cutoff, lamp_cutoff) nulls not distinct;

create materialized view scores_with_rank as
select *, rank() over (partition by chart_id order by score desc), row_number() over (partition by chart_id order by score desc) from scores;

create function refresh_scores_with_rank() returns boolean security definer as
$$
begin
  refresh materialized view scores_with_rank;
  return true;
end
$$ language plpgsql;
