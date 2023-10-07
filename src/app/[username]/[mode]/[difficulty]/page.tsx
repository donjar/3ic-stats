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
    process.env.NEXT_PUBLIC_SUPABASE_HOST,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const dbData = await supabase
    .from("scores")
    .select("lamp, score, charts!inner(id, difficulty, songs!inner(song_name))")
    .eq("username", username)
    .eq("charts.rating", difficulty)
    .in(
      "charts.difficulty",
      mode === "single"
        ? ["bSP", "BSP", "DSP", "ESP", "CSP"]
        : mode === "double"
        ? ["BDP", "DDP", "EDP", "CDP"]
        : [],
    );
  const data = dbData.data.map(
    ({
      lamp,
      score,
      charts: {
        id,
        difficulty,
        songs: { song_name },
      },
    }) => ({ song: song_name, chartId: id, difficulty, score, lamp }),
  );
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

  const l4score = nonzeroScores.reduce(
    ((accum, curr) =>
      accum +
      (curr >= 999000
        ? 5
        : curr >= 990000
        ? 4
        : curr >= 975000
        ? 3
        : curr >= 950000
        ? 2
        : curr >= 900000
        ? 1
        : 0)), 0
  );

  return (
    <>
      <h1>
        {mode} {difficulty}
      </h1>
      <p>Mean: {mean}</p>
      <p>Median: {median}</p>
      <p>
        L4Score: {l4score} / {nonzeroScores.length * 5} (
        {(l4score * 100) / nonzeroScores.length / 5}%)
      </p>
      <h2>Scores</h2>
      <ul>
        {data.map(({ song, difficulty, score, lamp, chartId }) => (
          <li key={chartId}>
            {song} ({difficulty}): {score}
          </li>
        ))}
      </ul>
    </>
  );
};

export default Page;
