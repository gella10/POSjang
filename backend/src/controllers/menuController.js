import { z } from "zod";
import pool from "../config/db.js";
import { asyncHandler } from "../utils/helpers.js";

export const listCategories = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query("SELECT id,name FROM categories ORDER BY name");
  res.json(rows);
});

export const createCategory = asyncHandler(async (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(2).max(80) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Category name is required." });
  try {
    const { rows } = await pool.query("INSERT INTO categories(name) VALUES($1) RETURNING *", [parsed.data.name]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "Category already exists." });
    throw err;
  }
});

export const listMenu = asyncHandler(async (req, res) => {
  const availableOnly = req.query.availableOnly === "true";
  const { rows } = await pool.query(
    `SELECT m.id,m.name,m.description,m.price,m.category_id,m.is_available,
            c.name AS category_name
     FROM menu_items m LEFT JOIN categories c ON c.id=m.category_id
     ${availableOnly ? "WHERE m.is_available=TRUE" : ""}
     ORDER BY c.name NULLS LAST,m.name`
  );
  res.json(rows);
});

const menuSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().optional().nullable(),
  price: z.number().nonnegative(),
  categoryId: z.number().int().positive().nullable().optional(),
  isAvailable: z.boolean().optional()
});

export const createMenuItem = asyncHandler(async (req, res) => {
  const p = menuSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: "Enter a name and a valid non-negative price." });
  const d = p.data;
  const { rows } = await pool.query(
    `INSERT INTO menu_items(name,description,price,category_id,is_available)
     VALUES($1,$2,$3,$4,$5) RETURNING *`,
    [d.name,d.description || null,d.price,d.categoryId ?? null,d.isAvailable ?? true]
  );
  res.status(201).json(rows[0]);
});

export const updateMenuItem = asyncHandler(async (req, res) => {
  const p = menuSchema.partial().safeParse(req.body);
  if (!p.success || Object.keys(p.data || {}).length === 0) return res.status(400).json({ message: "Provide valid menu fields to update." });
  const fields = { name:"name", description:"description", price:"price", categoryId:"category_id", isAvailable:"is_available" };
  const sets = []; const values = [];
  for (const [key, value] of Object.entries(p.data)) {
    values.push(key === "categoryId" ? value ?? null : value);
    sets.push(`${fields[key]}=$${values.length}`);
  }
  sets.push("updated_at=NOW()");
  values.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE menu_items SET ${sets.join(",")} WHERE id=$${values.length} RETURNING *`, values
  );
  if (!rows[0]) return res.status(404).json({ message: "Menu item not found." });
  res.json(rows[0]);
});
