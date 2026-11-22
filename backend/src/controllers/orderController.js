
import { z } from "zod";
import pool from "../config/db.js";
import {
  makeOrderNumber,
  asyncHandler,
  getDayRange
} from "../utils/helpers.js";

const orderSchema = z.object({
  items: z.array(
    z.object({
      menuItemId: z.number().int().positive(),
      quantity: z.number().int().positive().max(99)
    })
  ).min(1),
  paymentMethod: z.enum(["CASH", "INSTAPAY"])
});

export const createOrder = asyncHandler(async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Provide at least one valid menu item and a payment method."
    });
  }

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // Combine duplicate menu items into one quantity.
    const quantities = new Map();

    for (const item of parsed.data.items) {
      const currentQuantity = quantities.get(item.menuItemId) || 0;

      quantities.set(
        item.menuItemId,
        currentQuantity + item.quantity
      );
    }

    const menuItemIds = [...quantities.keys()];

    // Verify that all selected menu items are available.
    const { rows: products } = await client.query(
      `SELECT id, name, price
       FROM menu_items
       WHERE id = ANY($1::bigint[])
         AND is_available = TRUE
       FOR SHARE`,
      [menuItemIds]
    );

    if (products.length !== menuItemIds.length) {
      const error = new Error(
        "One or more selected menu items are unavailable or no longer exist."
      );
      error.status = 400;
      throw error;
    }

    const productsById = new Map(
      products.map((product) => [String(product.id), product])
    );

    const lines = menuItemIds.map((id) => {
      const product = productsById.get(String(id));
      const quantity = quantities.get(id);
      const unitPrice = Number(product.price);

      return {
        menuItemId: id,
        name: product.name,
        unitPrice,
        quantity,
        lineTotal: Number((unitPrice * quantity).toFixed(2))
      };
    });

    const total = Number(
      lines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2)
    );

    // Get the ingredient requirements for the selected menu items.
    const { rows: recipeRows } = await client.query(
      `SELECT
         menu_item_id,
         inventory_item_id,
         quantity_required
       FROM menu_item_ingredients
       WHERE menu_item_id = ANY($1::bigint[])
       ORDER BY inventory_item_id`,
      [menuItemIds]
    );

    // Calculate the total ingredient quantity needed.
    const ingredientRequirements = new Map();

    for (const recipe of recipeRows) {
      const inventoryId = String(recipe.inventory_item_id);

      const requiredPerMenuItem = Math.round(
        Number(recipe.quantity_required) * 1000
      );

      const menuQuantity = quantities.get(Number(recipe.menu_item_id));

      const totalRequired =
        requiredPerMenuItem * menuQuantity;

      ingredientRequirements.set(
        inventoryId,
        (ingredientRequirements.get(inventoryId) || 0) + totalRequired
      );
    }

    const inventoryIds = [...ingredientRequirements.keys()]
      .sort((a, b) => Number(a) - Number(b));

    // Lock inventory rows in a consistent order to reduce deadlocks.
    let inventoryById = new Map();

    if (inventoryIds.length > 0) {
      const { rows: inventoryRows } = await client.query(
        `SELECT id, name, stock_quantity, is_active
         FROM inventory_items
         WHERE id = ANY($1::bigint[])
         ORDER BY id
         FOR UPDATE`,
        [inventoryIds]
      );

      inventoryById = new Map(
        inventoryRows.map((item) => [String(item.id), item])
      );

      // Check ingredient availability before creating the order.
      for (const inventoryId of inventoryIds) {
        const inventoryItem = inventoryById.get(inventoryId);

        if (!inventoryItem || !inventoryItem.is_active) {
          const error = new Error(
            "A required recipe ingredient is unavailable."
          );
          error.status = 400;
          throw error;
        }

        const requiredQuantity =
          ingredientRequirements.get(inventoryId) / 1000;

        const availableQuantity = Number(
          inventoryItem.stock_quantity
        );

        if (availableQuantity < requiredQuantity) {
          const error = new Error(
            `Insufficient stock for ${inventoryItem.name}. ` +
            `Required: ${requiredQuantity}, available: ${availableQuantity}.`
          );
          error.status = 400;
          throw error;
        }
      }
    }

    // Create the order.
    const orderNumber = makeOrderNumber();

    const { rows: orderRows } = await client.query(
      `INSERT INTO orders
         (order_number, total, staff_id)
       VALUES ($1, $2, $3)
       RETURNING id, order_number, total, status, created_at`,
      [orderNumber, total, req.user.id]
    );

    const order = orderRows[0];

    // Save the order items.
    for (const line of lines) {
      await client.query(
        `INSERT INTO order_items
           (
             order_id,
             menu_item_id,
             item_name_snapshot,
             unit_price_snapshot,
             quantity,
             line_total
           )
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          order.id,
          line.menuItemId,
          line.name,
          line.unitPrice,
          line.quantity,
          line.lineTotal
        ]
      );
    }

    // Deduct ingredients and record SALE inventory transactions.
    for (const inventoryId of inventoryIds) {
      const requiredQuantity =
        ingredientRequirements.get(inventoryId) / 1000;

      const inventoryItem = inventoryById.get(inventoryId);

      const { rows: updatedRows } = await client.query(
        `UPDATE inventory_items
         SET
           stock_quantity = stock_quantity - $1,
           updated_at = NOW()
         WHERE id = $2
           AND is_active = TRUE
           AND stock_quantity >= $1
         RETURNING id`,
        [requiredQuantity, inventoryId]
      );

      if (updatedRows.length !== 1) {
        const error = new Error(
          `Insufficient stock for ${inventoryItem.name}.`
        );
        error.status = 400;
        throw error;
      }

      await client.query(
        `INSERT INTO inventory_transactions
           (
             inventory_item_id,
             transaction_type,
             quantity_change,
             order_id,
             notes,
             performed_by
           )
         VALUES ($1, 'SALE', $2, $3, $4, $5)`,
        [
          inventoryId,
          -requiredQuantity,
          order.id,
          `Ingredient deduction for order ${order.order_number}`,
          req.user.id
        ]
      );
    }

    // Record payment.
    await client.query(
      `INSERT INTO payments (order_id, method, amount)
       VALUES ($1, $2, $3)`,
      [order.id, parsed.data.paymentMethod, total]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(201).json({
      ...order,
      items: lines,
      payment: {
        method: parsed.data.paymentMethod,
        amount: total
      }
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Order rollback failed:", rollbackError);
      }
    }

    throw error;
  } finally {
    client.release();
  }
});

export const listOrders = asyncHandler(async (req, res) => {
  const values = [];
  let where = "WHERE 1=1";

  // Staff can only see their own orders.
  // Owners can see all orders.
  if (req.user.role !== "OWNER") {
    values.push(req.user.id);
    where += ` AND o.staff_id = $${values.length}`;
  }

  if (req.query.date) {
    const { start, end } = getDayRange(req.query.date);

    values.push(start, end);

    where += ` AND o.created_at >= $${values.length - 1}
               AND o.created_at < $${values.length}`;
  }

  const { rows } = await pool.query(
    `SELECT
       o.id,
       o.order_number,
       o.total,
       o.status,
       o.created_at,
       u.full_name AS staff_name,
       p.method AS payment_method,
       COALESCE(
         json_agg(
           json_build_object(
             'name', oi.item_name_snapshot,
             'unitPrice', oi.unit_price_snapshot,
             'quantity', oi.quantity,
             'lineTotal', oi.line_total
           )
         ) FILTER (WHERE oi.id IS NOT NULL),
         '[]'
       ) AS items
     FROM orders o
     JOIN users u ON u.id = o.staff_id
     LEFT JOIN payments p ON p.order_id = o.id
     LEFT JOIN order_items oi ON oi.order_id = o.id
     ${where}
     GROUP BY o.id, u.full_name, p.method
     ORDER BY o.created_at DESC
     LIMIT 200`,
    values
  );

  res.json(rows);
});
