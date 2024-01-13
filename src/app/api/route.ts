import { NextRequest } from "next/server";
import { Client } from "pg";

export const POST = async (req: NextRequest) => {
  const client = new Client();
  await client.connect();

  const res = await client.query(await req.json());
  await client.end();
  return Response.json(res.rows);
};
