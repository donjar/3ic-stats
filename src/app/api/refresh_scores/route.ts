import { createClient, SupabaseClient } from "@supabase/supabase-js";
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

const print = (s: string) => console.log(`[${new Date().toISOString()}] ${s}`);

const upsertData = async (
  supabase: SupabaseClient,
  chartScores: any[],
  chartId: string,
  page: number,
) => {
  while (true) {
    try {
      await supabase.from("scores").upsert(
        chartScores.map(({ username, score, lamp }) => ({
          chart_id: chartId,
          username: username,
          score: score,
          lamp: lamp,
        })),
        {
          onConflict: "chart_id,username",
          ignoreDuplicates: false,
          defaultToNull: true,
        },
      );
      print(`Done page ${page}`);
      break;
    } catch {}
  }
};

const fetchAndStoreData = async (
  supabase: SupabaseClient,
  page: number,
  size: number,
) => {
  print(`Doing page ${page} to ${page + size - 1}`);

  const charts = (
    await supabase
      .from("charts")
      .select("id, difficulty, rating, songs(song_id)")
      .order("id")
      .range(page, page + size - 1)
  ).data;
  if (!charts || charts.length === 0) {
    return;
  }

  await Promise.all(
    charts
      .map(async (c, idx) => {
        let res;
        while (true) {
          try {
            res = await fetch("https://3icecream.com/api/chart_ranking", {
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
            });
            break;
          } catch {}
        }
        const scoreData = await res.json();

        await upsertData(supabase, scoreData, charts[idx].id, page + idx);
      })
      .concat(fetchAndStoreData(supabase, page + size, size)),
  );
};

export const POST = async (req: NextRequest) => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_HOST ?? "",
    process.env.SUPABASE_SERVICE_KEY ?? "",
  );

  await fetchAndStoreData(
    supabase,
    parseInt(req.nextUrl.searchParams.get("page") ?? "0"),
    parseInt(req.nextUrl.searchParams.get("pageSize") ?? "1"),
  );

  print("Refreshing");
  await supabase.rpc("refresh_scores_with_rank");
  print("Done");

  return Response.json("ok");
};
