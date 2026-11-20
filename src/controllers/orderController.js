import { z } from "zod";
import pool from "../config/db.js";
import { makeOrderNumber, asyncHandler, getDayRange } from "../utils/helpers.js";

const orderSchema = z.object({
  items: z.array(z.object({ menuItemId: z.number().int().positive(), quantity: z.number().int().positive().max(99) })).min(1),
  paymentMethod: z.enum(["CASH", "INSTAPAY"])
});

export const createOrder = asyncHandler(async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Provide at least one valid menu item and a payment method." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const quantities = new Map();
    for (const item of parsed.data.items) quantities.set(item.menuItemId, (quantities.get(item.menuItemId) || 0) + item.quantity);
    const ids = [...quantities.keys()];
    const { rows: products } = await client.query(
      "SELECT id,name,price FROM menu_items WHERE id=ANY($1::bigint[]) AND is_available=TRUE FOR SHARE", [ids]
    );
    if (products.length !== ids.length) {
      const error = new Error("One or more selected menu items are unavailable or no longer exist.");
      error.status = 400; throw error;
    }
    const byId = new Map(products.map(p => [String(p.id), p]));
    const lines = ids.map(id => {
      const p = byId.get(String(id));
      const quantity = quantities.get(id);
      const unitPrice = Number(p.price);
      return { menuItemId:id, name:p.name, unitPrice, quantity, lineTotal:Number((unitPrice*quantity).toFixed(2)) };
    });
    const total = Number(lines.reduce((s,l)=>s+l.lineTotal,0).toFixed(2));
    const orderNumber = makeOrderNumber();
    const { rows: orderRows } = await client.query(
      "INSERT INTO orders(order_number,total,staff_id) VALUES($1,$2,$3) RETURNING id,order_number,total,status,created_at",
      [orderNumber,total,req.user.id]
    );
    const order = orderRows[0];
    for (const line of lines) {
      await client.query(
        `INSERT INTO order_items(order_id,menu_item_id,item_name_snapshot,unit_price_snapshot,quantity,line_total)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [order.id,line.menuItemId,line.name,line.unitPrice,line.quantity,line.lineTotal]
      );
    }
    await client.query("INSERT INTO payments(order_id,method,amount) VALUES($1,$2,$3)", [order.id,parsed.data.paymentMethod,total]);
    await client.query("COMMIT");
    res.status(201).json({ ...order, items:lines, payment:{ method:parsed.data.paymentMethod, amount:total } });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

export const listOrders = asyncHandler(async (req, res) => {
  const values = []; let where = "WHERE 1=1";
  if (req.user.role !== "OWNER") { values.push(req.user.id); where += ` AND o.staff_id=$${values.length}`; }
  if (req.query.date) {
    const { start,end } = getDayRange(req.query.date);
    values.push(start,end); where += ` AND o.created_at >= $${values.length-1} AND o.created_at < $${values.length}`;
  }
  const { rows } = await pool.query(
    `SELECT o.id,o.order_number,o.total,o.status,o.created_at,
            u.full_name AS staff_name,p.method AS payment_method,
            COALESCE(json_agg(json_build_object('name',oi.item_name_snapshot,'unitPrice',oi.unit_price_snapshot,'quantity',oi.quantity,'lineTotal',oi.line_total))
              FILTER (WHERE oi.id IS NOT NULL),'[]') AS items
     FROM orders o JOIN users u ON u.id=o.staff_id
     LEFT JOIN payments p ON p.order_id=o.id
     LEFT JOIN order_items oi ON oi.order_id=o.id
     ${where}
     GROUP BY o.id,u.full_name,p.method
     ORDER BY o.created_at DESC LIMIT 200`, values
  );
  res.json(rows);
});
