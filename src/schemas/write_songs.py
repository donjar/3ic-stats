import json
import requests
import psycopg
from datetime import datetime

data = requests.get("https://3icecream.com/js/songdata.js").text
cleaned = json.loads(
    data[len("var ALL_SONG_DATA=") :].split(";const EVENT_EXCLUSIONS")[0]
)

difficulties = ["bSP", "BSP", "DSP", "ESP", "CSP", "BDP", "DDP", "EDP", "CDP"]

with psycopg.connect("service=3ic") as conn:
    for c in cleaned:
        if c.get("deleted") == 1:
            continue

        print(f"Inserting: {c['song_name']}")

        now = datetime.now()
        with conn.cursor() as cur:
            cur.execute(
                f"""insert into songs (song_id, song_name, alphabet, version_num, created_at, updated_at)
                values (%s, %s, %s, %s, %s, %s)
                on conflict (song_id) do update set
                song_name = excluded.song_name, alphabet = excluded.alphabet, version_num = excluded.version_num, updated_at = excluded.updated_at
                returning id""",
                (
                    c["song_id"],
                    c["song_name"],
                    c["alphabet"],
                    c["version_num"],
                    now,
                    now,
                ),
            )
            song_id = cur.fetchone()[0]

            for r, difficulty in zip(c["ratings"], difficulties):
                if r == 0:
                    continue

                if r < 13:  # We only include difficulty >= 13 to save space
                    continue

                cur.execute(
                    f"""insert into charts (song_id, difficulty, rating, created_at, updated_at)
                    values (%s, %s, %s, %s, %s)
                    on conflict (song_id, difficulty) do update set
                    rating = excluded.rating, updated_at = excluded.updated_at
                    """,
                    (song_id, difficulty, r, now, now),
                )

            conn.commit()
