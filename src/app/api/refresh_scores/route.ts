import { createClient } from "@supabase/supabase-js";

const DIFFICULTIES = {
  bSP: 0,
  BSP: 1,
  DSP: 2,
  ESP: 3,
  CSP: 4,
  BDP: 5,
  DDP: 6,
  EDP: 7,
  CDP: 8,
};
const PAGINATION = 10;

export const POST = async () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_HOST,
    process.env.SUPABASE_SERVICE_KEY,
  );

  let page = 0;
  while (true) {
    const charts = (
      await supabase
        .from("charts")
        .select("id, difficulty, rating, songs (song_id)")
        .order("id")
        .range(page, page + PAGINATION - 1)
    ).data;
    if (charts.length === 0) {
      break;
    }
    console.log(`Fetching page ${page} to ${page + PAGINATION}`);
    const data = await Promise.all(
      charts.map((c) =>
        fetch("https://3icecream.com/api/chart_ranking", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            song_id: c.songs.song_id,
            SP_or_DP: DIFFICULTIES[c.difficulty] <= 4 ? 0 : 1,
            difficulty: DIFFICULTIES[c.difficulty],
          }),
        }).then((d) => d.json()),
      ),
    );
    console.log("Done");

    const now = new Date().toISOString();
    await supabase.from("scores").insert(
      data.flatMap((d, i) =>
        d.map((s) => ({
          chart_id: charts[i].id,
          username: s.username,
          score: s.score,
          lamp: s.lamp,
          created_at: now,
          updated_at: now,
        })),
      ),
    );

    page = page + PAGINATION;
  }

  return Response.json("ok");
};
