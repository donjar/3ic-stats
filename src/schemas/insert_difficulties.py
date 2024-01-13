import psycopg
import numpy as np
from collections import defaultdict
from datetime import datetime
from scipy.optimize import minimize
from scipy.special import log_ndtr


def get_data(rating, sp_or_dp="D", score_cutoff=None, lamp_cutoff=None):
    conn = psycopg.connect("service=local")

    charts = conn.execute(
        f"select count(distinct charts.id) from charts inner join scores on scores.chart_id = charts.id inner join songs on charts.song_id = songs.id where difficulty like '%{sp_or_dp}P' and rating = {rating}"
    ).fetchone()[0]
    d = conn.execute(
        f"select difficulty, username, score, lamp, song_name from scores inner join charts on scores.chart_id = charts.id inner join songs on charts.song_id = songs.id where difficulty like '%{sp_or_dp}P' and rating = {rating};"
    ).fetchall()

    data = defaultdict(dict)
    for difficulty, username, score, lamp, song_name in d:
        data[username][f"{song_name} {difficulty}"] = (
            (1 if score >= score_cutoff else -1)
            if score_cutoff is not None
            else (1 if lamp >= lamp_cutoff else -1)
        )

    ls = []
    all_players = []
    all_charts = []

    chart_to_idx = {}
    for username, dat in data.items():
        all_players.append(username)
        row = [0 for _ in range(charts)]

        for chart_id, pt in dat.items():
            if chart_id not in chart_to_idx:
                chart_to_idx[chart_id] = len(chart_to_idx)
                all_charts.append(chart_id)
            row[chart_to_idx[chart_id]] = pt

        ls.append(row)

    ls = np.array(ls)

    return ls, all_players, all_charts


def write_to_pg(res, score_cutoff, lamp_cutoff):
    conn = psycopg.connect("service=local")
    for row in res:
        song, diff = row
        diff = float(diff)

        title = song[:-4]
        diffi = song[-3:]

        chart_id = conn.execute(
            "select charts.id from charts inner join songs on charts.song_id = songs.id where songs.song_name = %s and charts.difficulty = %s",
            (title, diffi),
        ).fetchone()[0]
        conn.execute(
            "insert into difficulties (chart_id, score_cutoff, lamp_cutoff, difficulty, updated_at) values (%s, %s, %s, %s, %s) on conflict (chart_id, score_cutoff, lamp_cutoff) do update set difficulty = excluded.difficulty, updated_at = excluded.updated_at",
            (chart_id, score_cutoff, lamp_cutoff, diff, datetime.now()),
        )
        conn.commit()


def main(rating, sp_or_dp="D", score_cutoff=None, lamp_cutoff=None):
    print(rating, sp_or_dp, score_cutoff, lamp_cutoff)
    ls, all_players, all_charts = get_data(rating, sp_or_dp, score_cutoff, lamp_cutoff)

    players = len(all_players)
    charts = len(all_charts)

    x0 = [0] * (players + charts - 1)
    bounds = [(-5, 5)] * (players + charts - 1)

    def get_processed(X):
        return np.concatenate([[0], X])

    def fn(X):
        x = get_processed(X)
        diffs = np.subtract.outer(x[:players], x[players:])
        to_compute = diffs * ls
        return -log_ndtr(to_compute).sum()

    res = minimize(fn, x0, bounds=bounds, options={"maxfun": 1e6})
    print(res)

    res2 = get_processed(res.x)
    res2[:players]
    chart_results = res2[players:]

    nmlzd = (chart_results - np.min(chart_results)) / np.ptp(chart_results) * 100

    res = sorted(zip(all_charts, nmlzd), key=lambda x: -x[1])

    write_to_pg(res, score_cutoff, lamp_cutoff)


# main(rating=17, score_cutoff=950000)
# main(rating=15, score_cutoff=990000)
# main(rating=15, score_cutoff=975000)
# main(rating=14, lamp_cutoff=1, sp_or_dp="S")
main(rating=13, lamp_cutoff=1, sp_or_dp="S")
