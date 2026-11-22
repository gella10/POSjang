
import "dotenv/config";
import assert from "node:assert/strict";
import pool from "../src/config/db.js";

const BASE_URL = process.env.API_BASE_URL || "http://localhost:5000/api";
const OWNER_EMAIL = process.env.OWNER_EMAIL;
const OWNER_PASSWORD = process.env.OWNER_PASSWORD;

if (!OWNER_EMAIL || !OWNER_PASSWORD) {
  console.error("Missing OWNER_EMAIL or OWNER_PASSWORD in .env");
  process.exit(1);
}

const results = [];
const suffix = Date.now();

let ownerToken;
let staffToken;
let categoryId;
let menuItemId;

let inventoryTestItems = [];
let inventoryItemIds = [];
let createdInventoryItemId;

let orderRecipeInventoryId;
let createdOrderId;

const staffEmail = `test-staff-${suffix}@example.com`;
const staffPassword = "StaffTest123!";
const testDate = new Date().toISOString().slice(0, 10);

async function request(path, options = {}, token) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  return { status: response.status, data };
}

async function test(name, callback) {
  try {
    await callback();
    results.push({ name, passed: true });
    console.log(`✅ PASS: ${name}`);
  } catch (error) {
    results.push({ name, passed: false });
    console.log(`❌ FAIL: ${name}`);
    console.log(`   ${error.message}`);
  }
}

async function cleanupInventoryTestData() {
  if (inventoryItemIds.length > 0) {
    // Remove recipe references first.
    await pool.query(
      `DELETE FROM menu_item_ingredients
       WHERE inventory_item_id = ANY($1::bigint[])`,
      [inventoryItemIds]
    );

    // Remove inventory transaction records.
    await pool.query(
      `DELETE FROM inventory_transactions
       WHERE inventory_item_id = ANY($1::bigint[])`,
      [inventoryItemIds]
    );

    // Remove temporary inventory records.
    await pool.query(
      `DELETE FROM inventory_items
       WHERE id = ANY($1::bigint[])`,
      [inventoryItemIds]
    );
  }

  inventoryItemIds = [];
  createdInventoryItemId = null;
  orderRecipeInventoryId = null;
}

async function main() {
  console.log("\n================================");
  console.log(" POJANGMACHA POS API TEST SUITE");
  console.log("================================\n");

  // ==========================================
  // AUTHENTICATION TESTS
  // ==========================================

  // 1. Health check
  await test("API health check", async () => {
    const r = await request("/health");

    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.status, "ok");
  });

  // 2. Owner login
  await test("Owner login", async () => {
    const r = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: OWNER_EMAIL,
        password: OWNER_PASSWORD
      })
    });

    assert.equal(r.status, 200, JSON.stringify(r.data));

    ownerToken = r.data.token;
    assert.ok(ownerToken, "No owner token returned");
  });

  // 3. Owner profile
  await test("Get logged-in owner profile", async () => {
    assert.ok(ownerToken, "Owner login failed");

    const r = await request("/auth/me", {}, ownerToken);

    assert.equal(r.status, 200, JSON.stringify(r.data));
  });

  // 4. Create staff
  await test("Create staff account", async () => {
    assert.ok(ownerToken, "Owner login failed");

    const r = await request("/auth/users", {
      method: "POST",
      body: JSON.stringify({
        fullName: "Automated Test Staff",
        email: staffEmail,
        password: staffPassword,
        role: "STAFF"
      })
    }, ownerToken);

    assert.ok([200, 201].includes(r.status), JSON.stringify(r.data));
  });

  // 5. Staff login
  await test("Staff login", async () => {
    const r = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: staffEmail,
        password: staffPassword
      })
    });

    assert.equal(r.status, 200, JSON.stringify(r.data));

    staffToken = r.data.token;
    assert.ok(staffToken, "No staff token returned");
  });

  // ==========================================
  // INVENTORY TESTS
  // ==========================================

  // Create temporary database records for inventory listing tests.
  await test("Create temporary inventory test records", async () => {
    inventoryTestItems = [
      {
        name: `Test Low Stock ${suffix}`,
        stock: 5,
        reorder: 10
      },
      {
        name: `Test Normal Stock ${suffix}`,
        stock: 20,
        reorder: 10
      }
    ];

    const result = await pool.query(
      `
        INSERT INTO inventory_items
          (name, unit, stock_quantity, reorder_level, is_active)
        VALUES
          ($1, 'pcs', $2, $3, true),
          ($4, 'pcs', $5, $6, true)
        RETURNING id
      `,
      [
        inventoryTestItems[0].name,
        inventoryTestItems[0].stock,
        inventoryTestItems[0].reorder,
        inventoryTestItems[1].name,
        inventoryTestItems[1].stock,
        inventoryTestItems[1].reorder
      ]
    );

    inventoryItemIds.push(...result.rows.map(item => item.id));

    assert.equal(result.rows.length, 2);
  });

  // 6. Unauthenticated inventory access
  await test("Unauthenticated users cannot access inventory", async () => {
    const r = await request("/inventory");

    assert.equal(r.status, 401, JSON.stringify(r.data));
  });

  // 7. Owner inventory listing
  await test("Owner can retrieve inventory with correct fields and low-stock status", async () => {
    assert.ok(ownerToken, "Owner login failed");

    const r = await request("/inventory", {}, ownerToken);

    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.ok(Array.isArray(r.data));

    for (const expected of inventoryTestItems) {
      const item = r.data.find(row => row.name === expected.name);

      assert.ok(item, `Inventory item not found: ${expected.name}`);

      assert.ok("id" in item);
      assert.ok("name" in item);
      assert.ok("unit" in item);
      assert.ok("stock_quantity" in item);
      assert.ok("reorder_level" in item);
      assert.ok("is_active" in item);
      assert.ok("is_low_stock" in item);

      assert.equal(item.unit, "pcs");
      assert.equal(Number(item.stock_quantity), expected.stock);
      assert.equal(Number(item.reorder_level), expected.reorder);
      assert.equal(item.is_active, true);

      assert.equal(
        item.is_low_stock,
        expected.stock <= expected.reorder
      );
    }
  });

  // 8. Staff inventory listing
  await test("Staff can retrieve inventory", async () => {
    assert.ok(staffToken, "Staff login failed");

    const r = await request("/inventory", {}, staffToken);

    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.ok(Array.isArray(r.data));
  });

  // 9. Staff cannot create inventory
  await test("Staff cannot create inventory items", async () => {
    const r = await request("/inventory", {
      method: "POST",
      body: JSON.stringify({
        name: `Staff Inventory ${suffix}`,
        unit: "pcs",
        reorderLevel: 5
      })
    }, staffToken);

    assert.equal(r.status, 403, JSON.stringify(r.data));
  });

  // 10. Owner creates inventory
  await test("Owner can create an inventory item", async () => {
    const r = await request("/inventory", {
      method: "POST",
      body: JSON.stringify({
        name: `Test Created Inventory ${suffix}`,
        unit: "packs",
        reorderLevel: 5
      })
    }, ownerToken);

    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.ok(r.data.item, "Created inventory item was not returned");

    const item = r.data.item;

    assert.ok(item.id);
    assert.equal(item.name, `Test Created Inventory ${suffix}`);
    assert.equal(item.unit, "packs");
    assert.equal(Number(item.stock_quantity), 0);
    assert.equal(Number(item.reorder_level), 5);
    assert.equal(item.is_active, true);

    createdInventoryItemId = item.id;
    inventoryItemIds.push(item.id);
  });

  // 11. Invalid inventory creation
  await test("Reject inventory creation with invalid details", async () => {
    const r = await request("/inventory", {
      method: "POST",
      body: JSON.stringify({
        name: "",
        unit: "",
        reorderLevel: -1
      })
    }, ownerToken);

    assert.equal(r.status, 400, JSON.stringify(r.data));
  });

  // 12. Owner updates inventory
  await test("Owner can update inventory item details", async () => {
    assert.ok(createdInventoryItemId, "Inventory creation failed");

    const r = await request(`/inventory/${createdInventoryItemId}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: `Test Updated Inventory ${suffix}`,
        reorderLevel: 8
      })
    }, ownerToken);

    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.ok(r.data.item);

    assert.equal(r.data.item.name, `Test Updated Inventory ${suffix}`);
    assert.equal(Number(r.data.item.reorder_level), 8);
  });

  // 13. Reject empty inventory update
  await test("Reject inventory update with no fields", async () => {
    assert.ok(createdInventoryItemId);

    const r = await request(`/inventory/${createdInventoryItemId}`, {
      method: "PATCH",
      body: JSON.stringify({})
    }, ownerToken);

    assert.equal(r.status, 400, JSON.stringify(r.data));
  });

  // 14. Staff cannot update inventory
  await test("Staff cannot update inventory items", async () => {
    assert.ok(createdInventoryItemId);

    const r = await request(`/inventory/${createdInventoryItemId}`, {
      method: "PATCH",
      body: JSON.stringify({
        reorderLevel: 20
      })
    }, staffToken);

    assert.equal(r.status, 403, JSON.stringify(r.data));
  });

  // 15. Owner restocks inventory
  await test("Owner can restock inventory and record a transaction", async () => {
    assert.ok(createdInventoryItemId);

    const r = await request(
      `/inventory/${createdInventoryItemId}/restock`,
      {
        method: "POST",
        body: JSON.stringify({
          quantity: 15,
          notes: "Automated restock test"
        })
      },
      ownerToken
    );

    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.ok(r.data.item);
    assert.ok(r.data.transaction);

    assert.equal(Number(r.data.item.stock_quantity), 15);
    assert.equal(r.data.transaction.type, "RESTOCK");
    assert.equal(Number(r.data.transaction.quantity_change), 15);
    assert.equal(
      r.data.transaction.notes,
      "Automated restock test"
    );
  });

  // 16. Verify restock transaction in database
  await test("Restock creates an inventory transaction record", async () => {
    assert.ok(createdInventoryItemId);

    const result = await pool.query(
      `SELECT transaction_type, quantity_change, notes
       FROM inventory_transactions
       WHERE inventory_item_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [createdInventoryItemId]
    );

    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].transaction_type, "RESTOCK");
    assert.equal(Number(result.rows[0].quantity_change), 15);
    assert.equal(
      result.rows[0].notes,
      "Automated restock test"
    );
  });

  // 17. Reject invalid restock quantity
  await test("Reject restock with invalid quantity", async () => {
    assert.ok(createdInventoryItemId);

    const r = await request(
      `/inventory/${createdInventoryItemId}/restock`,
      {
        method: "POST",
        body: JSON.stringify({
          quantity: -5
        })
      },
      ownerToken
    );

    assert.equal(r.status, 400, JSON.stringify(r.data));
  });

  // 18. Staff cannot restock inventory
  await test("Staff cannot restock inventory items", async () => {
    assert.ok(createdInventoryItemId);

    const r = await request(
      `/inventory/${createdInventoryItemId}/restock`,
      {
        method: "POST",
        body: JSON.stringify({
          quantity: 10
        })
      },
      staffToken
    );

    assert.equal(r.status, 403, JSON.stringify(r.data));
  });

  // 19. Inactive inventory cannot be restocked
  await test("Inactive inventory items cannot be restocked", async () => {
    assert.ok(createdInventoryItemId);

    const update = await request(
      `/inventory/${createdInventoryItemId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          isActive: false
        })
      },
      ownerToken
    );

    assert.equal(update.status, 200, JSON.stringify(update.data));

    const r = await request(
      `/inventory/${createdInventoryItemId}/restock`,
      {
        method: "POST",
        body: JSON.stringify({
          quantity: 10
        })
      },
      ownerToken
    );

    assert.equal(r.status, 400, JSON.stringify(r.data));
    assert.match(r.data.message, /inactive/i);
  });

  // 20. Clean up temporary inventory records
  await test("Remove temporary inventory test records", async () => {
    await cleanupInventoryTestData();

    assert.equal(inventoryItemIds.length, 0);
    assert.equal(createdInventoryItemId, null);
  });

  // ==========================================
  // MENU AND ORDER TESTS
  // ==========================================

  // 21. Get categories
  await test("Retrieve menu categories", async () => {
    assert.ok(ownerToken);

    const r = await request("/menu/categories", {}, ownerToken);

    assert.equal(r.status, 200, JSON.stringify(r.data));
  });

  // 22. Create category
  await test("Create menu category", async () => {
    const r = await request("/menu/categories", {
      method: "POST",
      body: JSON.stringify({
        name: `Automated Test Category ${suffix}`
      })
    }, ownerToken);

    assert.ok([200, 201].includes(r.status), JSON.stringify(r.data));

    categoryId = r.data.id;
    assert.ok(categoryId);
  });

  // 23. Create menu item
  await test("Create menu item", async () => {
    assert.ok(categoryId, "Category creation failed");

    const r = await request("/menu", {
      method: "POST",
      body: JSON.stringify({
        categoryId: Number(categoryId),
        name: `Automated Test Buldak ${suffix}`,
        description: "Created by automated API test",
        price: 109,
        isAvailable: true
      })
    }, ownerToken);

    assert.ok([200, 201].includes(r.status), JSON.stringify(r.data));

    menuItemId = r.data.id;
    assert.ok(menuItemId);
  });

  // 24. Create recipe ingredient for order testing
  await test("Create recipe ingredient for order inventory testing", async () => {
    assert.ok(menuItemId, "Menu item creation failed");

    const result = await pool.query(
      `INSERT INTO inventory_items
         (name, unit, stock_quantity, reorder_level)
       VALUES ($1, 'packs', 10, 2)
       RETURNING id`,
      [`Test Order Ingredient ${suffix}`]
    );

    orderRecipeInventoryId = result.rows[0].id;
    inventoryItemIds.push(orderRecipeInventoryId);

    await pool.query(
      `INSERT INTO menu_item_ingredients
         (menu_item_id, inventory_item_id, quantity_required)
       VALUES ($1, $2, 2)`,
      [menuItemId, orderRecipeInventoryId]
    );
  });

  // 25. Get menu
  await test("Retrieve menu items", async () => {
    const r = await request("/menu", {}, ownerToken);

    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.ok(Array.isArray(r.data));
  });

  // 26. Update menu price
  await test("Update menu item price", async () => {
    assert.ok(menuItemId);

    const r = await request(`/menu/${menuItemId}`, {
      method: "PATCH",
      body: JSON.stringify({
        price: 119,
        isAvailable: true
      })
    }, ownerToken);

    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(Number(r.data.price), 119);
  });

  // 27. Staff cannot create categories
  await test("Staff cannot create menu categories", async () => {
    const r = await request("/menu/categories", {
      method: "POST",
      body: JSON.stringify({
        name: `Staff Forbidden ${suffix}`
      })
    }, staffToken);

    assert.equal(r.status, 403, JSON.stringify(r.data));
  });

  // 28. Staff can view menu
  await test("Staff can retrieve menu", async () => {
    const r = await request("/menu", {}, staffToken);

    assert.equal(r.status, 200, JSON.stringify(r.data));
  });

  // ==========================================
  // ORDER AND RECIPE INVENTORY TESTS
  // ==========================================

  // 29. Create order and deduct recipe ingredients
  await test("Create customer order and deduct recipe ingredients", async () => {
    assert.ok(menuItemId);
    assert.ok(orderRecipeInventoryId);

    const r = await request("/orders", {
      method: "POST",
      body: JSON.stringify({
        items: [
          {
            menuItemId: Number(menuItemId),
            quantity: 1
          }
        ],
        paymentMethod: "CASH"
      })
    }, staffToken);

    assert.equal(r.status, 201, JSON.stringify(r.data));

    createdOrderId = r.data.id;
    assert.ok(createdOrderId);

    const stock = await pool.query(
      `SELECT stock_quantity
       FROM inventory_items
       WHERE id = $1`,
      [orderRecipeInventoryId]
    );

    assert.equal(stock.rows.length, 1);
    assert.equal(Number(stock.rows[0].stock_quantity), 8);
  });

  // 30. Verify SALE inventory transaction
  await test("Order creates a SALE inventory transaction", async () => {
    assert.ok(createdOrderId);
    assert.ok(orderRecipeInventoryId);

    const result = await pool.query(
      `SELECT transaction_type, quantity_change, order_id
       FROM inventory_transactions
       WHERE order_id = $1
         AND inventory_item_id = $2`,
      [createdOrderId, orderRecipeInventoryId]
    );

    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].transaction_type, "SALE");
    assert.equal(Number(result.rows[0].quantity_change), -2);
    assert.equal(
      String(result.rows[0].order_id),
      String(createdOrderId)
    );
  });

  // 31. Reject order when ingredient stock is insufficient
  await test("Reject order when recipe ingredient stock is insufficient", async () => {
    await pool.query(
      `UPDATE inventory_items
       SET stock_quantity = 1
       WHERE id = $1`,
      [orderRecipeInventoryId]
    );

    const r = await request("/orders", {
      method: "POST",
      body: JSON.stringify({
        items: [
          {
            menuItemId: Number(menuItemId),
            quantity: 1
          }
        ],
        paymentMethod: "CASH"
      })
    }, staffToken);

    assert.equal(r.status, 400, JSON.stringify(r.data));
    assert.match(r.data.message, /insufficient stock/i);

    const stock = await pool.query(
      `SELECT stock_quantity
       FROM inventory_items
       WHERE id = $1`,
      [orderRecipeInventoryId]
    );

    assert.equal(Number(stock.rows[0].stock_quantity), 1);
  });

  // 32. Retrieve orders
  await test("Retrieve orders", async () => {
    const r = await request("/orders", {}, ownerToken);

    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.ok(Array.isArray(r.data));
  });

  // 33. Mark item unavailable
  await test("Mark menu item unavailable", async () => {
    const r = await request(`/menu/${menuItemId}`, {
      method: "PATCH",
      body: JSON.stringify({
        isAvailable: false
      })
    }, ownerToken);

    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.is_available, false);
  });

  // 34. Reject unavailable item order
  await test("Reject order containing unavailable item", async () => {
    const r = await request("/orders", {
      method: "POST",
      body: JSON.stringify({
        items: [
          {
            menuItemId: Number(menuItemId),
            quantity: 1
          }
        ],
        paymentMethod: "CASH"
      })
    }, staffToken);

    assert.equal(r.status, 400, JSON.stringify(r.data));
  });

  // 35. Restore availability
  await test("Restore menu item availability", async () => {
    const r = await request(`/menu/${menuItemId}`, {
      method: "PATCH",
      body: JSON.stringify({
        isAvailable: true
      })
    }, ownerToken);

    assert.equal(r.status, 200, JSON.stringify(r.data));
  });

  // ==========================================
  // REPORT AND RECONCILIATION TESTS
  // ==========================================

  // 36. Daily report
  await test("Retrieve daily sales report", async () => {
    const r = await request(
      `/reports/daily?date=${testDate}`,
      {},
      ownerToken
    );

    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.ok("total_sales" in r.data);
    assert.ok(Array.isArray(r.data.items));
  });

  // 37. Cash reconciliation
  await test("Save cash reconciliation", async () => {
    const report = await request(
      `/reports/daily?date=${testDate}`,
      {},
      ownerToken
    );

    assert.equal(report.status, 200, JSON.stringify(report.data));

    const amount = Math.round(Number(report.data.cash_sales || 0));

    let remaining = amount;
    const denominations = [1000, 500, 200, 100, 50, 20, 10, 5, 1];
    const counts = {};

    for (const denomination of denominations) {
      counts[String(denomination)] = Math.floor(
        remaining / denomination
      );

      remaining %= denomination;
    }

    const r = await request("/reports/reconciliations", {
      method: "POST",
      body: JSON.stringify({
        date: testDate,
        counts,
        notes: "Automated API test"
      })
    }, ownerToken);

    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.equal(Number(r.data.actual_cash), amount);
  });

  // 38. Reconciliation history
  await test("Retrieve reconciliation history", async () => {
    const r = await request(
      "/reports/reconciliations",
      {},
      ownerToken
    );

    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.ok(Array.isArray(r.data));
  });

  // 39. Staff cannot access owner reports
  await test("Staff cannot access daily sales report", async () => {
    const r = await request(
      `/reports/daily?date=${testDate}`,
      {},
      staffToken
    );

    assert.equal(r.status, 403, JSON.stringify(r.data));
  });

  // ==========================================
  // TEST SUMMARY
  // ==========================================

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;

  console.log("\n================================");
  console.log("             SUMMARY");
  console.log("================================");
  console.log(`Total tests: ${results.length}`);
  console.log(`Passed:      ${passed}`);
  console.log(`Failed:      ${failed}`);
  console.log("================================\n");

  if (failed > 0) {
    console.log("Some tests failed. Check the error messages above.");
    process.exitCode = 1;
  } else {
    console.log("🎉 ALL AUTOMATED TESTS PASSED!");
  }
}

main()
  .catch(error => {
    console.error("Test suite encountered an unexpected error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Safety cleanup in case an inventory test failed before normal cleanup.
    try {
      await cleanupInventoryTestData();
    } catch (error) {
      console.error("Inventory test cleanup failed:", error);
      process.exitCode = 1;
    }

    await pool.end();
  });
