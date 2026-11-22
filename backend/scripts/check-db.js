
import "dotenv/config";
import pool from "../src/config/db.js";

try {
  const result = await pool.query(`
    SELECT
      NOW() AS database_time,
      current_database() AS database_name
  `);

  console.log("Database connection successful!");
  console.log("Database:", result.rows[0].database_name);
  console.log("Database time:", result.rows[0].database_time);
} catch (error) {
  console.error("Database connection failed:");
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
