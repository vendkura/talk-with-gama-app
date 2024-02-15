import { neon } from "@neondatabase/serverless";
export const getNeon = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("NEON_API_KEY is not set");
  }
  const sql = neon(process.env.DATABASE_URL);
  return sql;
};
