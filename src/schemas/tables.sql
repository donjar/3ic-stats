create table songs (
  id uuid primary key default uuid_generate_v4(),
  song_id varchar not null,
  song_name varchar not null,
  alphabet varchar not null,
  version_num integer not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null
);

create table charts (
  id uuid primary key default uuid_generate_v4(),
  song_id uuid not null references songs (id),
  difficulty varchar not null,
  rating integer not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null
);
create index charts_rating_idx on charts (rating);

create table scores (
  id uuid primary key default uuid_generate_v4(),
  chart_id uuid not null references charts (id),
  username varchar not null,
  score integer not null,
  lamp integer not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null,

  unique (chart_id, username)
);
create index scores_chart_id_score_idx on scores (chart_id, score);

create view scores_with_rank as select *, rank() over (partition by chart_id order by score desc) from scores;

create view scores_enriched as select username, rating, lamp, score, rank, chart_id, difficulty, song_name from scores_with_rank right outer join charts on scores_with_rank.chart_id = charts.id right outer join songs on charts.song_id = songs.id order by rank desc;
