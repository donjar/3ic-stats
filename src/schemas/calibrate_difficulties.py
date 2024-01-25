import psycopg
from pprint import pprint


def show_avail_diffs():
    conn = psycopg.connect("service=3ic")
    pprint(
        conn.execute(
            "select distinct substring(charts.difficulty from 2 for 1), rating, score_cutoff, lamp_cutoff from difficulties inner join charts on chart_id = charts.id order by 1, 2, 3, 4"
        ).fetchall()
    )


def calibrate(zero, hundred, rating, sp_or_dp="D", score_cutoff=None, lamp_cutoff=None):
    conn = psycopg.connect("service=3ic", cursor_factory=psycopg.ClientCursor)
    d = conn.execute(
        """
        select chart_id, difficulties.difficulty
        from difficulties
        inner join charts on chart_id = charts.id
        where (%s is null or score_cutoff = %s)
        and (%s is null or lamp_cutoff = %s)
        and charts.difficulty like %s
        and rating = %s
        order by 2
        """,
        (score_cutoff, score_cutoff, lamp_cutoff, lamp_cutoff, f"%{sp_or_dp}P", rating),
    ).fetchall()
    pprint(d)

    scores = {str(a): float(b) for a, b in d}
    m = 100 / (scores[hundred] - scores[zero])
    c = -scores[zero]

    for chart, score in scores.items():
        # print(
        conn.execute(
            "update difficulties set difficulty = %s where chart_id = %s and score_cutoff is not distinct from %s and lamp_cutoff is not distinct from %s",
            (m * score + c, chart, score_cutoff, lamp_cutoff),
        )
    conn.commit()


show_avail_diffs()
calibrate(
    zero="c7fcb888-9229-4e2e-b7db-38f4023473f9",
    hundred="8dd53849-fe49-40b0-b1a2-d410974c52c5",
    sp_or_dp="S",
    rating=14,
    lamp_cutoff=1,
)
