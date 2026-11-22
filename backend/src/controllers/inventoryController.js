
import { z } from "zod";
import pool from "../config/db.js";
import { asyncHandler } from "../utils/helpers.js";

// Validation schemas
const createInventorySchema = z.object({
  name: z.string().trim().min(1).max(160),
  unit: z.string().trim().min(1).max(30),
  reorderLevel: z.number().nonnegative().default(0)
});

const updateInventorySchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  unit: z.string().trim().min(1).max(30).optional(),
  reorderLevel: z.number().nonnegative().optional(),
  isActive: z.boolean().optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "Provide at least one field to update."
});

const restockInventorySchema = z.object({
  quantity: z.number().positive(),
  notes: z.string().trim().max(500).optional()
});

// GET /api/inventory
// Retrieve all inventory items
export const listInventory = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT
      id,
      name,
      unit,
      stock_quantity,
      reorder_level,
      is_active,
      (stock_quantity <= reorder_level) AS is_low_stock
    FROM inventory_items
    ORDER BY name
  `);

  res.json(rows);
});

// POST /api/inventory
// Create a new inventory item
export const createInventory = asyncHandler(async (req, res) => {
  const parsed = createInventorySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid inventory details.",
      errors: parsed.error.issues
    });
  }

  const { name, unit, reorderLevel } = parsed.data;

  const { rows } = await pool.query(
    `INSERT INTO inventory_items
      (name, unit, stock_quantity, reorder_level)
     VALUES ($1, $2, 0, $3)
     RETURNING id, name, unit, stock_quantity, reorder_level,
       is_active, (stock_quantity <= reorder_level) AS is_low_stock`,
    [name, unit, reorderLevel]
  );

  res.status(201).json({
    message: "Inventory item created successfully.",
    item: rows[0]
  });
});

// PATCH /api/inventory/:id
// Update inventory item details
export const updateInventory = asyncHandler(async (req, res) => {
  const parsed = updateInventorySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid inventory details.",
      errors: parsed.error.issues
    });
  }

  const id = req.params.id;

  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      message: "Invalid inventory item ID."
    });
  }

  const fields = parsed.data;

  const columnMap = {
    name: "name",
    unit: "unit",
    reorderLevel: "reorder_level",
    isActive: "is_active"
  };

  const updates = [];
  const values = [];

  for (const [key, value] of Object.entries(fields)) {
    values.push(value);
    updates.push(`${columnMap[key]} = $${values.length}`);
  }

  updates.push("updated_at = NOW()");
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE inventory_items
     SET ${updates.join(", ")}
     WHERE id = $${values.length}
     RETURNING id, name, unit, stock_quantity, reorder_level,
       is_active, (stock_quantity <= reorder_level) AS is_low_stock`,
    values
  );

  if (rows.length === 0) {
    return res.status(404).json({
      message: "Inventory item not found."
    });
  }

  res.json({
    message: "Inventory item updated successfully.",
    item: rows[0]
  });
});

// POST /api/inventory/:id/restock
// Add stock and record the transaction
export const restockInventory = asyncHandler(async (req, res) => {
  const parsed = restockInventorySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid restock details.",
      errors: parsed.error.issues
    });
  }

  const id = req.params.id;

  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      message: "Invalid inventory item ID."
    });
  }

  const { quantity, notes } = parsed.data;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: items } = await client.query(
      `SELECT id, name, unit, stock_quantity, reorder_level, is_active
       FROM inventory_items
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (items.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Inventory item not found."
      });
    }

    const item = items[0];

    if (!item.is_active) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message: "Cannot restock an inactive inventory item."
      });
    }

    const { rows: updatedItems } = await client.query(
      `UPDATE inventory_items
       SET stock_quantity = stock_quantity + $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, unit, stock_quantity, reorder_level,
         is_active, (stock_quantity <= reorder_level) AS is_low_stock`,
      [quantity, id]
    );

    await client.query(
      `INSERT INTO inventory_transactions
        (inventory_item_id, transaction_type, quantity_change, notes, performed_by)
       VALUES ($1, 'RESTOCK', $2, $3, $4)`,
      [id, quantity, notes || null, req.user.id]
    );

    await client.query("COMMIT");

    res.json({
      message: "Inventory restocked successfully.",
      item: updatedItems[0],
      transaction: {
        type: "RESTOCK",
        quantity_change: quantity,
        notes: notes || null
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});
