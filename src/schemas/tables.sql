create table songs (
  id uuid primary key default uuid_generate_v4(),
  song_id varchar not null,
  song_name varchar not null,
  alphabet varchar not null,
  version_num integer not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create table charts (
  id uuid primary key default uuid_generate_v4(),
  song_id uuid not null references songs (id),
  difficulty varchar not null,
  rating integer not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
create index charts_rating_idx on charts (rating);

create table scores (
  id uuid primary key default uuid_generate_v4(),
  chart_id uuid not null references charts (id),
  username varchar not null,
  score integer not null,
  lamp integer not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null,

  unique (chart_id, username)
);
create index scores_chart_id_score_idx on scores (chart_id, score);
