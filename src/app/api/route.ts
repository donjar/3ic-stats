import { NextRequest } from "next/server";
import { Client } from "pg";

export const POST = async (req: NextRequest) => {
  const client = new Client({
    host: "localhost",
    database: "3ic",
    user: "readonly",
    password: "readonly",
  });
  await client.connect();

  const res = await client.query(...((await req.json()) as [string, any[]]));
  await client.end();
  return Response.json(res.rows);
};
