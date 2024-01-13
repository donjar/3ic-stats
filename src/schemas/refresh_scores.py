import asyncio
import httpx
import psycopg
import tqdm
from aiolimiter import AsyncLimiter
from datetime import datetime

DIFFICULTIES = {
    "bSP": 0,
    "BSP": 1,
    "DSP": 2,
    "ESP": 3,
    "CSP": 4,
    "BDP": 5,
    "DDP": 6,
    "EDP": 7,
    "CDP": 8,
}

limiter = AsyncLimiter(60)


async def execute_req(client, cur, conn, chart_id, difficulty, song_id, song_name):
    while True:
        await limiter.acquire()
        try:
            res = await client.post(
                "https://3icecream.com/api/chart_ranking",
                json={
                    "song_id": song_id,
                    "SP_OR_DP": 0 if DIFFICULTIES[difficulty] <= 4 else 1,
                    "difficulty": DIFFICULTIES[difficulty],
                },
                timeout=None,
            )
            break
        except Exception:
            continue
    res.raise_for_status()
    # print(f"({datetime.now()}) Done {song_name} {difficulty}")

    return chart_id, res.json()


async def main():
    async with await psycopg.AsyncConnection.connect(
        "service=local"
    ) as conn, httpx.AsyncClient() as client:
        async with conn.cursor() as cur:
            await cur.execute(
                """select charts.id, difficulty, songs.song_id, song_name
                from charts
                inner join songs on charts.song_id = songs.id"""
            )
            data = await cur.fetchall()

            await cur.execute("truncate scores")
            await cur.execute("drop index scores_chart_id_score_idx")
            with cursor.copy("copy scores (chart_id, username, score, lamp) from stdin") as copy:
                for chart_id, difficulty, song_id, song_name in tqdm.tqdm(data):
                    res = await execute_req(
                        client, cur, conn, chart_id, difficulty, song_id, song_name
                    )

                    for row in res:
                        copy.write_row((chart_id, row["username"], row["score"], row["lamp"]))

            await cur.execute(
                "create index scores_chart_id_score_idx on scores (chart_id, score)"
            )
            await cur.execute("select refresh_scores_with_rank()")
            await conn.commit()


asyncio.run(main())
