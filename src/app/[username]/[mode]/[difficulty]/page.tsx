import { createClient } from "@supabase/supabase-js";

interface Params {
  username: string;
  mode: string;
  difficulty: string;
}

const Page = async ({
  params: { username, mode, difficulty },
}: {
  params: Params;
}) => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_HOST ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  );

  const dbData = await supabase
    .from("scores_with_rank")
    .select(
      "lamp, score, rank, charts!inner(id, difficulty, songs!inner(song_name))",
    )
    .eq("username", username)
    .eq("charts.rating", difficulty)
    .in(
      "charts.difficulty",
      mode === "single"
        ? ["bSP", "BSP", "DSP", "ESP", "CSP"]
        : mode === "double"
        ? ["BDP", "DDP", "EDP", "CDP"]
        : [],
    )
    .order("rank");
  const data = (dbData.data as any[])?.map(
    ({
      lamp,
      score,
      rank,
      charts: {
        id,
        difficulty,
        songs: { song_name },
      },
    }) => ({ song: song_name, chartId: id, difficulty, score, rank, lamp }),
  );
  if (!data) {
    return null;
  }

  const scores = data.map(({ score }) => score);
  const nonzeroScores = scores.filter((s) => s != 0).sort((a, b) => a - b);

  const median =
    nonzeroScores.length % 2
      ? nonzeroScores[Math.floor(nonzeroScores.length / 2)]
      : (nonzeroScores[Math.floor(nonzeroScores.length / 2) - 1] +
          nonzeroScores[Math.floor(nonzeroScores.length / 2)]) /
        2;
  const mean =
    nonzeroScores.reduce((accum, curr) => accum + curr) / nonzeroScores.length;

  const l4scores = nonzeroScores.map(
    (s) =>
      (s >= 999000
        ? 5
        : s >= 990000
        ? 4
        : s >= 975000
        ? 3
        : s >= 950000
        ? 2
        : s >= 900000
        ? 1
        : 0) as number,
  );
  const l4score = l4scores.reduce((accum, curr) => accum + curr);

  return (
    <>
      <h1>
        {username} - {mode} {difficulty}
      </h1>
      <p>Mean: {mean.toFixed(0)}</p>
      <p>Median: {median}</p>
      <p>
        L4Score: {l4score} / {nonzeroScores.length * 5} (
        {((l4score * 100) / nonzeroScores.length / 5).toFixed(2)}%) (
        {[0, 1, 2, 3, 4, 5]
          .map((i) => l4scores.filter((j) => i === j).length)
          .join(", ")}
        )
      </p>
      <h2>Scores</h2>
      <ul>
        {data.map(({ song, difficulty, score, rank, lamp, chartId }) => (
          <li key={chartId}>
            {song} ({difficulty}): #{rank} ({score})
          </li>
        ))}
      </ul>
    </>
  );
};

export default Page;
