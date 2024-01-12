"use client";

import supabase from "../../../../../../lib/supabase";
import { useEffect, useState } from "react";
import { Card, Checkbox, Spin, Col, Row } from "antd";
import Head from "next/head";
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
  cutoff: string;
}

interface Datum {
  song: string;
  chartId: string;
  difficulty: string;
  score: number;
  lamp: number;
  diffi: number;
}

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

const chunkifyAndSend = async <T, U>(
  data: T[],
  lambda: (data: T[]) => Promise<U[]>,
): Promise<U[]> => {
  const split = 100;
  let i = 0;
  let res: U[] = [];

  while (i < data.length) {
    res = res.concat(await lambda(data.slice(i, i + split)));
    i += 100;
  }

  return res;
};

const Page = ({
  params: { username, mode, difficulty, cutoff },
}: {
  params: Params;
}) => {
  const [selection, setSelection] = useState<string[]>([
    "Show Clear",
    "Sort Ascending",
  ]);
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

      const scoresWithRank = await chunkifyAndSend(
        chartsData.map(({ id }) => id),
        async (data) =>
          (
            await supabase
              .from("scores_with_rank")
              .select()
              .eq("username", username)
              .in("chart_id", data)
          ).data ?? [],
      );
      const scoresByChartId = Object.fromEntries(
        scoresWithRank.map((s) => [s.chart_id, s]),
      );

      const difficultiesData = await chunkifyAndSend(
        chartsData.map(({ id }) => id),
        async (data) =>
          (
            await supabase
              .from("difficulties")
              .select()
              .in("chart_id", data)
              .eq("score_cutoff", cutoff)
          ).data ?? [],
      );
      const difficultiesByChartId = Object.fromEntries(
        difficultiesData.map((s) => [s.chart_id, s.difficulty]),
      );

      setData(
        chartsData
          // @ts-expect-error
          .map(({ id, difficulty, songs: { song_name } }) => ({
            song: song_name,
            chartId: id,
            difficulty,
            score: scoresByChartId[id]?.score,
            lamp: scoresByChartId[id]?.lamp,
            diffi: difficultiesByChartId[id],
          })),
      );
    })();
  }, [username, mode, difficulty, cutoff]);

  if (!data) {
    return <Spin size="large" />;
  }

  const sortedData = data
    .sort(
      (a, b) =>
        (selection.includes("Sort Ascending") ? 1 : -1) *
        ((a.diffi ?? 101) - (b.diffi ?? 101)),
    )
    .filter(
      (s) =>
        (selection.includes("Show Clear") ||
          !s.score ||
          s.score < Number(cutoff)) &&
        (selection.includes("Show No Score") || s.score),
    );

  const title = `${username} - ${mode} ${difficulty} (${cutoff})`;

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h2>Scores</h2>
        <Checkbox.Group
          options={["Show Clear", "Show No Score", "Sort Ascending"]}
          value={selection}
          // @ts-expect-error
          onChange={setSelection}
          style={{ backgroundColor: "white" }}
        />
        <Row gutter={[8, 8]}>
          {sortedData.map(
            ({ song, difficulty, score, lamp, chartId, diffi }) => (
              <Col xs={24} md={8} key={chartId}>
                <Card
                  title={
                    <span style={{ color: getColorFromDifficulty(difficulty) }}>
                      {song}
                    </span>
                  }
                  size="small"
                  style={{
                    backgroundColor:
                      score >= Number(cutoff)
                        ? green[1]
                        : score
                        ? "white"
                        : "#ddd",
                  }}
                >
                  <p>Difficulty {diffi?.toFixed(0)}</p>
                  <p style={{ color: RANK_COLORS[lamp] }}>{score ?? "-"}</p>
                </Card>
              </Col>
            ),
          )}
        </Row>
      </div>
    </>
  );
};

export default Page;
