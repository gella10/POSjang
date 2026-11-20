
import "dotenv/config";
import bcrypt from "bcryptjs";
import pool from "../src/config/db.js";

const email = "owner@pojang.com";
const password = "pojang143";

try {
  const existing = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [email]
  );

  if (existing.rowCount > 0) {
    console.log("Owner account already exists.");
  } else {
    const passwordHash = await bcrypt.hash(password, 12);

    await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, 'OWNER')`,
      ["Store Owner", email, passwordHash]
    );

    console.log("Owner account created successfully!");
    console.log("Email:", email);
    console.log("Password:", password);
  }
} catch (error) {
  console.error("Error creating owner:", error.message);
} finally {
  await pool.end();
}
