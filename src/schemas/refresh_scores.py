import asyncio
import httpx
import psycopg
import tqdm
from aiolimiter import AsyncLimiter
from bs4 import BeautifulSoup
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

limiter = AsyncLimiter(120)


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
            bpms = (
                BeautifulSoup(
                    (await client.get(
                        f"https://3icecream.com/ddr/song_details/{song_id}",
                        timeout=None,
                    )).text
                )
                .find_all("span", class_="sp-bpm")
            )
            bpm = bpms[-1].text if len(bpms) > 0 else None
            break
        except Exception:
            continue
    res.raise_for_status()
    # print(f"({datetime.now()}) Done {song_name} {difficulty}")

    return bpm, res.json()


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
            bpms = []
            async with cur.copy("copy scores (chart_id, username, score, lamp) from stdin") as copy:
                for chart_id, difficulty, song_id, song_name in tqdm.tqdm(data):
                    bpm, res = await execute_req(
                        client, cur, conn, chart_id, difficulty, song_id, song_name
                    )
                    bpms.append((bpm, song_id))

                    for row in res:
                        await copy.write_row((chart_id, row["username"], row["score"], row["lamp"]))

            for bpm, song_id in bpms:
                await cur.execute(
                    "update songs set bpm = %s where song_id = %s", (bpm, song_id)
                )

            await cur.execute(
                "create index scores_chart_id_score_idx on scores (chart_id, score)"
            )
            await cur.execute("select refresh_scores_with_rank()")
            await conn.commit()


asyncio.run(main())
