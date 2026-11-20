import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import pool from "../config/db.js";
import { asyncHandler } from "../utils/helpers.js";

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const createStaffSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["STAFF", "OWNER"]).default("STAFF")
});

export const login = asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Enter a valid email and password." });
  const email = parsed.data.email.toLowerCase();
  const { rows } = await pool.query("SELECT id, full_name, email, password_hash, role, is_active FROM users WHERE email=$1", [email]);
  const user = rows[0];
  if (!user || !user.is_active || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
    return res.status(401).json({ message: "Invalid email or password." });
  }
  const token = jwt.sign(
    { id: user.id, name: user.full_name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "12h" }
  );
  res.json({ token, user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role } });
});

export const me = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, full_name, email, role, is_active FROM users WHERE id=$1",
    [req.user.id]
  );
  if (!rows[0] || !rows[0].is_active) return res.status(401).json({ message: "Account is unavailable." });
  const u = rows[0];
  res.json({ id: u.id, fullName: u.full_name, email: u.email, role: u.role });
});

// Public registration is disabled. Owner-only account creation is used instead.
export const register = (_req, res) =>
  res.status(403).json({ message: "Public registration is disabled. Ask the owner to create an account." });

export const createUser = asyncHandler(async (req, res) => {
  const parsed = createStaffSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Provide a valid name, email, role and password (minimum 8 characters)." });
  const hash = await bcrypt.hash(parsed.data.password, 12);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users(full_name,email,password_hash,role)
       VALUES($1,$2,$3,$4) RETURNING id,full_name,email,role,is_active`,
      [parsed.data.fullName, parsed.data.email.toLowerCase(), hash, parsed.data.role]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "Email is already registered." });
    throw err;
  }
});

export const listUsers = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id,full_name,email,role,is_active,created_at FROM users ORDER BY full_name"
  );
  res.json(rows);
});
