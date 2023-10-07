"use client";

import supabase from "../../../../lib/supabase";
import { useEffect, useState } from "react";
import { Button, Card, Spin, Col, Row, Space } from "antd";
import { DoubleLeftOutlined, DoubleRightOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";

interface Params {
  username: string;
  mode: string;
  difficulty: string;
}

interface Datum {
  song: string;
  chartId: string;
  difficulty: number;
  score: number;
  rank: number;
  lamp: number;
  cutoff: number;
}

const CUTOFFS = [900000, 950000, 975000, 990000, 999000];

const Page = ({
  params: { username, mode, difficulty },
}: {
  params: Params;
}) => {
  const router = useRouter();

  const [cutoffMode, setCutoffMode] = useState<number | null>(null);

  const [data, setData] = useState<Datum[] | null>(null);
  useEffect(() => {
    (async () => {
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
        .order("rank", { ascending: false });

      setData(
        (dbData.data as any[])?.map(
          ({
            lamp,
            score,
            rank,
            charts: {
              id,
              difficulty,
              songs: { song_name },
            },
          }) => ({
            song: song_name,
            chartId: id,
            difficulty,
            score,
            rank,
            lamp,
            cutoff: CUTOFFS.findLastIndex((c) => score >= c) + 1,
          }),
        ),
      );
    })();
  }, [username, mode, difficulty]);

  if (!data) {
    return <Spin size="large" />;
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

  const cutoffScore = data.reduce((accum, { cutoff }) => accum + cutoff, 0);

  const otherMode =
    mode === "single" ? "double" : mode === "double" ? "single" : "";

  return (
    <>
      <Space>
        <h1>
          {username} - {mode} {difficulty}
        </h1>
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
            type="link"
            onClick={() => setCutoffMode(i)}
          >
            {data.filter(({ cutoff }) => i === cutoff).length}
          </Button>
        ))}
        <Button size="small" type="link" onClick={() => setCutoffMode(null)}>
          Reset
        </Button>
      </p>
      <h2>Scores</h2>
      <Row gutter={[8, 8]}>
        {data.flatMap(
          ({ song, difficulty, score, rank, lamp, chartId, cutoff }) =>
            [null, cutoff].includes(cutoffMode)
              ? [
                  <Col md={8} key={chartId}>
                    <Card title={song} size="small">
                      <p>Score: {score}</p>
                      <p>Rank: {rank}</p>
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
