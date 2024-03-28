"use client";

import runSql from "../../../../../../lib/run-sql";
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
      const charts = await runSql(
        `select charts.id, difficulty, songs.song_name, bpm
         from charts
         inner join songs on charts.song_id = songs.id
         where rating = $1
         and difficulty in (select * from unnest($2::text[]))`,
        [
          difficulty,
          mode === "single"
            ? ["bSP", "BSP", "DSP", "ESP", "CSP"]
            : mode === "double"
            ? ["BDP", "DDP", "EDP", "CDP"]
            : [],
        ],
      );

      const scoresWithRank = await runSql(
        `select chart_id, score, lamp from scores_with_rank
         where username = $1 and chart_id in (select * from unnest($2::uuid[]))`,
        [username, charts.map(({ id }) => id)],
      );
      const scoresByChartId = Object.fromEntries(
        scoresWithRank.map((s) => [s.chart_id, s]),
      );

      const difficultiesData = await runSql(
        `select chart_id, difficulty from difficulties
         where score_cutoff = $1 and chart_id in (select * from unnest($2::uuid[]))`,
        [cutoff, charts.map(({ id }) => id)],
      );
      const difficultiesByChartId = Object.fromEntries(
        difficultiesData.map((s) => [s.chart_id, Number(s.difficulty)]),
      );

      setData(
        charts.map(({ id, difficulty, song_name, bpm }) => ({
          song: song_name,
          chartId: id,
          difficulty,
          bpm,
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
            ({ song, difficulty, score, lamp, chartId, diffi, bpm }) => (
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
                  <p>Difficulty {diffi?.toFixed(0)} BPM {bpm}</p>
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
