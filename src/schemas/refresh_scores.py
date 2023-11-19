import asyncio
import httpx
import psycopg
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


async def execute(cur, chart_id, res_row):
    await cur.execute(
        """insert into scores (chart_id, username, score, lamp)
        values (%s, %s, %s, %s)
        on conflict (chart_id, username) do update set
        score = excluded.score, lamp = excluded.lamp""",
        (chart_id, res_row["username"], res_row["score"], res_row["lamp"]),
    )


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

    await asyncio.gather(*[execute(cur, chart_id, res_row) for res_row in res.json()])
    await conn.commit()
    print(f"({datetime.now()}) Done {song_name} {difficulty}")


async def main():
    async with await psycopg.AsyncConnection.connect(
        "service=3ic"
    ) as conn, httpx.AsyncClient() as client:
        async with conn.cursor() as cur:
            await cur.execute(
                """select charts.id, difficulty, songs.song_id, song_name
                from charts
                inner join songs on charts.song_id = songs.id"""
            )
            data = await cur.fetchall()

            await asyncio.gather(
                *[
                    execute_req(
                        client, cur, conn, chart_id, difficulty, song_id, song_name
                    )
                    for chart_id, difficulty, song_id, song_name in data
                ]
            )

            await cur.execute("select refresh_scores_with_rank()")
            await conn.commit()


asyncio.run(main())
