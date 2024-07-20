import csv
import psycopg
import numpy as np
from collections import defaultdict
from datetime import datetime
from scipy.optimize import minimize
from scipy.special import log_ndtr


def get_data(rating, sp_or_dp="D", score_cutoff=None, lamp_cutoff=None):
    conn = psycopg.connect("service=3ic")

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


def get_89k_dp_data(_rating, _sp_or_dp, _score_cutoff, _lamp_cutoff):
    """
    16EX --> GFC 993k+
    17IX, 18IX --> FC or 980k+
    """
    conn = psycopg.connect("service=3ic")

    charts = conn.execute(
        f"select count(distinct charts.id) from charts inner join scores on scores.chart_id = charts.id inner join songs on charts.song_id = songs.id where difficulty like '%DP' and rating in (16, 17, 18)"
    ).fetchone()[0]
    d = conn.execute(
        f"select rating, difficulty, username, score, lamp, song_name from scores inner join charts on scores.chart_id = charts.id inner join songs on charts.song_id = songs.id where difficulty like '%DP' and rating in (16, 17, 18);"
    ).fetchall()

    data = defaultdict(dict)
    for rating, difficulty, username, score, lamp, song_name in d:
        flare = "EX" if rating == 16 else "IX"
        is_pass = (rating == 16 and lamp >= 4 and score >= 993000) or (rating != 16 and (lamp >= 3 or score >= 980000))
        data[username][f"{song_name} {difficulty} {flare}"] = 1 if is_pass else -1

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
    conn = psycopg.connect("service=3ic")
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


def main(rating=None, sp_or_dp="D", score_cutoff=None, lamp_cutoff=None, fn=get_data, pg=True, csv_name=None):
    if not pg and not csv_name:
        raise Exception("No output")
    print(rating, sp_or_dp, score_cutoff, lamp_cutoff)
    ls, all_players, all_charts = fn(rating, sp_or_dp, score_cutoff, lamp_cutoff)

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

    chart_results = get_processed(res.x)[players:]
    nmlzd = (chart_results - np.min(chart_results)) / np.ptp(chart_results) * 100
    result = sorted(zip(all_charts, nmlzd), key=lambda x: -x[1])

    if pg:
        write_to_pg(result, score_cutoff, lamp_cutoff)
    if csv_name:
        with open(csv_name, 'w', newline='') as f:
            csv.writer(f).writerows(result)

# main(rating=16, sp_or_dp="D", lamp_cutoff=5)
# main(rating=17, sp_or_dp="D", lamp_cutoff=5)
# main(rating=18, sp_or_dp="D", lamp_cutoff=5)
# main(rating=19, sp_or_dp="D", lamp_cutoff=1, csv_name="19_clear.csv")
main(fn=get_89k_dp_data, pg=False, csv_name="89k.csv")
