"use client";

import supabase from "../../../../lib/supabase";
import { useEffect, useState } from "react";
import { Button, Card, Spin, Col, Row, Space } from "antd";
import { DoubleLeftOutlined, DoubleRightOutlined } from "@ant-design/icons";
import Head from "next/head";
import { useRouter } from "next/navigation";
import {
  blue,
  gold,
  red,
  green,
  purple,
  volcano,
  magenta,
} from "@ant-design/colors";

interface Params {
  username: string;
  mode: string;
  difficulty: string;
}

interface Datum {
  song: string;
  chartId: string;
  difficulty: string;
  score: number;
  rank: number;
  lamp: number;
  cutoff: number;
  targetScore: number;
}

const CUTOFFS = [900000, 950000, 975000, 990000, 999000];

const getColorFromDifficulty = (difficulty: string) =>
  ({
    b: blue.primary,
    B: gold.primary,
    D: red.primary,
    E: green.primary,
    C: purple.primary,
  })[difficulty[0]];

const RANK_COLORS = [
  volcano.primary,
  "#000000",
  red.primary,
  blue.primary,
  green.primary,
  gold.primary,
  magenta.primary,
];

const Page = ({
  params: { username, mode, difficulty },
}: {
  params: Params;
}) => {
  const router = useRouter();

  const [cutoffMode, setCutoffMode] = useState<number | null>(null);
  const [lampMode, setLampMode] = useState<number | null>(null);

  const [data, setData] = useState<Datum[] | null>(null);
  useEffect(() => {
    (async () => {
      const charts = await supabase
        .from("charts")
        .select("id, difficulty, songs(song_name)")
        .eq("rating", difficulty)
        .in(
          "difficulty",
          mode === "single"
            ? ["bSP", "BSP", "DSP", "ESP", "CSP"]
            : mode === "double"
            ? ["BDP", "DDP", "EDP", "CDP"]
            : [],
        );
      const chartsData = charts.data ?? [];

      const scoresWithRank = await supabase
        .from("scores_with_rank")
        .select()
        .eq("username", username)
        .in(
          "chart_id",
          chartsData.map(({ id }) => id),
        );
      const scoresByChartId = Object.fromEntries(
        (scoresWithRank.data ?? []).map((s) => [s.chart_id, s]),
      );

      const targetScores = await supabase
        .from("scores_with_rank")
        .select()
        .eq("row_number", 100)
        .in(
          "chart_id",
          chartsData.map(({ id }) => id),
        );
      const targetScoresByChartId = Object.fromEntries(
        (targetScores.data ?? []).map((s) => [s.chart_id, s]),
      );

      setData(
        chartsData
          // @ts-ignore
          .map(({ id, difficulty, songs: { song_name } }) => ({
            song: song_name,
            chartId: id,
            difficulty,
            score: scoresByChartId[id]?.score,
            rank: scoresByChartId[id]?.rank,
            lamp: scoresByChartId[id]?.lamp,
            cutoff:
              scoresByChartId[id] &&
              CUTOFFS.findLastIndex((c) => scoresByChartId[id].score >= c) + 1,
            targetScore: targetScoresByChartId[id]?.score,
          }))
          .sort((a, b) => (b.rank ?? -1) - (a.rank ?? -1)),
      );
    })();
  }, [username, mode, difficulty]);

  if (!data) {
    return <Spin size="large" />;
  }

  console.log(data);

  const scores = data.map(({ score }) => score);
  const nonzeroScores = scores.filter((s) => !!s).sort((a, b) => a - b);

  const median =
    nonzeroScores.length % 2
      ? nonzeroScores[Math.floor(nonzeroScores.length / 2)]
      : (nonzeroScores[Math.floor(nonzeroScores.length / 2) - 1] +
          nonzeroScores[Math.floor(nonzeroScores.length / 2)]) /
        2;
  const mean =
    nonzeroScores.reduce((accum, curr) => accum + curr) / nonzeroScores.length;

  const cutoffScore = data.reduce(
    (accum, { cutoff }) => accum + (cutoff ?? 0),
    0,
  );

  const otherMode =
    mode === "single" ? "double" : mode === "double" ? "single" : "";

  const title = `${username} - ${mode} ${difficulty}`;

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <Space>
        <h1>{title}</h1>
        <Button
          size="small"
          icon={<DoubleLeftOutlined />}
          onClick={() =>
            router.push(`/${username}/${mode}/${parseInt(difficulty) - 1}`)
          }
        />
        <Button
          size="small"
          onClick={() => router.push(`/${username}/${otherMode}/${difficulty}`)}
        >
          {otherMode}
        </Button>
        <Button
          size="small"
          icon={<DoubleRightOutlined />}
          onClick={() =>
            router.push(`/${username}/${mode}/${parseInt(difficulty) + 1}`)
          }
        />
      </Space>
      <p>Mean: {mean.toFixed(0)}</p>
      <p>Median: {median}</p>
      <p>
        Cutoff Progress: {cutoffScore} / {nonzeroScores.length * 5} (
        {((cutoffScore * 100) / nonzeroScores.length / 5).toFixed(2)}%)
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Button
            size="small"
            key={i}
            type={i !== cutoffMode ? "link" : "default"}
            onClick={() => setCutoffMode(i)}
          >
            {data.filter(({ cutoff }) => i === cutoff).length}
          </Button>
        ))}
        <Button size="small" type="link" onClick={() => setCutoffMode(null)}>
          Reset
        </Button>
      </p>
      <p>
        Lamps
        {[0, 1, 3, 4, 5, 6].map((i) => (
          <Button
            size="small"
            key={i}
            type={i !== lampMode ? "link" : "default"}
            onClick={() => setLampMode(i)}
          >
            {data.filter(({ lamp }) => i === lamp).length}
          </Button>
        ))}
        <Button size="small" type="link" onClick={() => setLampMode(null)}>
          Reset
        </Button>
      </p>
      <h2>Scores</h2>
      <Row gutter={[8, 8]}>
        {data.flatMap(
          ({
            song,
            difficulty,
            score,
            rank,
            lamp,
            chartId,
            cutoff,
            targetScore,
          }) =>
            [null, cutoff].includes(cutoffMode) &&
            [null, lamp].includes(lampMode)
              ? [
                  <Col xs={24} md={8} key={chartId}>
                    <Card
                      title={
                        <span
                          style={{ color: getColorFromDifficulty(difficulty) }}
                        >
                          {song}
                        </span>
                      }
                      size="small"
                    >
                      <p>
                        <span style={{ color: RANK_COLORS[lamp] }}>
                          {score}
                        </span>{" "}
                        #{rank}
                      </p>
                      <p>#100: {targetScore}</p>
                    </Card>
                  </Col>,
                ]
              : [],
        )}
      </Row>
    </>
  );
};

export default Page;
