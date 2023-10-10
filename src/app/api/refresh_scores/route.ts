import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

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
} as Record<string, number>;

export const POST = async (req: NextRequest) => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_HOST ?? "",
    process.env.SUPABASE_SERVICE_KEY ?? "",
  );

  let page = parseInt(req.nextUrl.searchParams.get("page") ?? "0");
  const pagination = parseInt(
    req.nextUrl.searchParams.get("pagination") ?? "100",
  );
  while (true) {
    const charts = (
      await supabase
        .from("charts")
        .select("id, difficulty, rating, songs(song_id)")
        .order("id")
        .range(page, page + pagination - 1)
    ).data;
    if (!charts || charts.length === 0) {
      break;
    }
    console.log(`Fetching page ${page} to ${page + pagination}`);
    const data = await Promise.all(
      charts.map((c) =>
        fetch("https://3icecream.com/api/chart_ranking", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            // @ts-ignore
            song_id: c.songs.song_id,
            SP_or_DP: DIFFICULTIES[c.difficulty] <= 4 ? 0 : 1,
            difficulty: DIFFICULTIES[c.difficulty],
          }),
        }).then((d) => d.json()),
      ),
    );
    console.log("Done");

    const now = new Date().toISOString();
    await supabase
      .from("scores")
      .upsert(
        data.flatMap((d, i) =>
          d.map((s: any) => ({
            chart_id: charts[i].id,
            username: s.username,
            score: s.score,
            lamp: s.lamp,
            updated_at: now,
          })),
        ),
        {
          onConflict: "chart_id,username",
          ignoreDuplicates: false,
          defaultToNull: true,
        },
      )
      .select();

    page = page + pagination;
  }

  await supabase.rpc("refresh_scores_with_rank");

  return Response.json("ok");
};
