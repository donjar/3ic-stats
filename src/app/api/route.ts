import { NextRequest } from "next/server";
import { Client } from "pg";

export const POST = async (req: NextRequest) => {
  const client = new Client({
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });
  await client.connect();

  const res = await client.query(...((await req.json()) as [string, any[]]));
  await client.end();
  return Response.json(res.rows);
};
