const runSql = async (sqlText: string, params: any[]): Promise<any[]> =>
  await (
    await fetch("/api", {
      method: "POST",
      body: JSON.stringify([sqlText, params]),
    })
  ).json();

export default runSql;
