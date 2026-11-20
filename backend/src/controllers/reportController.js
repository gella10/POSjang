
import { z } from "zod";
import pool from "../config/db.js";
import { asyncHandler, getDayRange } from "../utils/helpers.js";
import { CASH_DENOMINATIONS } from "../config/constants.js";

export const dailyReport = asyncHandler(async (req, res) => {
  const { start, end, date } = getDayRange(req.query.date);

  const { rows: totals } = await pool.query(
    `SELECT COUNT(*)::int AS order_count,
       COALESCE(SUM(o.total), 0) AS total_sales,
       COALESCE(SUM(o.total) FILTER (WHERE p.method = 'CASH'), 0) AS cash_sales,
       COALESCE(SUM(o.total) FILTER (WHERE p.method = 'INSTAPAY'), 0) AS instapay_sales
     FROM orders o
     LEFT JOIN payments p ON p.order_id = o.id
     WHERE o.status = 'COMPLETED'
       AND o.created_at >= $1 AND o.created_at < $2`,
    [start, end]
  );

  const { rows: items } = await pool.query(
    `SELECT oi.item_name_snapshot AS item_name,
            SUM(oi.quantity)::int AS quantity_sold,
            SUM(oi.line_total) AS total_sales
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.status = 'COMPLETED'
       AND o.created_at >= $1 AND o.created_at < $2
     GROUP BY oi.item_name_snapshot
     ORDER BY total_sales DESC`,
    [start, end]
  );

  res.json({ date, ...totals[0], items });
});

export const saveReconciliation = asyncHandler(async (req, res) => {
  const schema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    counts: z.record(z.string(), z.number().int().nonnegative()),
    notes: z.string().max(1000).optional()
  });

  const p = schema.safeParse(req.body);

  if (!p.success) {
    console.log("Validation errors:", p.error.issues);
    return res.status(400).json({
      message: "Invalid reconciliation data.",
      errors: p.error.issues
    });
  }

  for (const key of Object.keys(p.data.counts)) {
    if (!CASH_DENOMINATIONS.includes(Number(key))) {
      return res.status(400).json({
        message: `Unsupported denomination: ${key}`
      });
    }
  }

  const { start, end, date } = getDayRange(p.data.date);

  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS cash_sales
     FROM payments
     WHERE method = 'CASH'
       AND created_at >= $1 AND created_at < $2`,
    [start, end]
  );

  const recorded = Number(rows[0].cash_sales);

  const actual = Object.entries(p.data.counts).reduce(
    (sum, [denomination, count]) =>
      sum + Number(denomination) * count,
    0
  );

  const difference = Number((actual - recorded).toFixed(2));

  const result = await pool.query(
    `INSERT INTO cash_reconciliations
      (business_date, recorded_cash_sales, actual_cash, difference,
       denomination_counts, notes, reconciled_by)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
     ON CONFLICT (business_date) DO UPDATE SET
       recorded_cash_sales = EXCLUDED.recorded_cash_sales,
       actual_cash = EXCLUDED.actual_cash,
       difference = EXCLUDED.difference,
       denomination_counts = EXCLUDED.denomination_counts,
       notes = EXCLUDED.notes,
       reconciled_by = EXCLUDED.reconciled_by,
       updated_at = NOW()
     RETURNING *`,
    [
      date,
      recorded,
      actual,
      difference,
      JSON.stringify(p.data.counts),
      p.data.notes || null,
      req.user.id
    ]
  );

  res.status(201).json(result.rows[0]);
});

export const reconciliationHistory = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM cash_reconciliations
     ORDER BY business_date DESC
     LIMIT 100`
  );

  res.json(rows);
});
