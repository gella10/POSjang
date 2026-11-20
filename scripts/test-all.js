
import "dotenv/config";
import assert from "node:assert/strict";

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
let staffEmail = `test-staff-${suffix}@example.com`;
let staffPassword = "StaffTest123!";
let testDate = new Date().toISOString().slice(0, 10);

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

async function main() {
  console.log("\n================================");
  console.log(" POJANGMACHA POS API TEST SUITE");
  console.log("================================\n");

  // 1. Health check
  await test("API health check", async () => {
    const r = await request("/health");
    assert.equal(r.status, 200);
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

  // 6. Get categories
  await test("Retrieve menu categories", async () => {
    assert.ok(ownerToken);
    const r = await request("/menu/categories", {}, ownerToken);
    assert.equal(r.status, 200, JSON.stringify(r.data));
  });

  // 7. Create category
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

  // 8. Create menu item
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

  // 9. Get menu
  await test("Retrieve menu items", async () => {
    const r = await request("/menu", {}, ownerToken);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.ok(Array.isArray(r.data));
  });

  // 10. Update menu price
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

  // 11. Staff cannot create categories
  await test("Staff cannot create menu categories", async () => {
    const r = await request("/menu/categories", {
      method: "POST",
      body: JSON.stringify({
        name: `Staff Forbidden ${suffix}`
      })
    }, staffToken);

    assert.equal(r.status, 403, JSON.stringify(r.data));
  });

  // 12. Staff can view menu
  await test("Staff can retrieve menu", async () => {
    const r = await request("/menu", {}, staffToken);
    assert.equal(r.status, 200, JSON.stringify(r.data));
  });

  // 13. Create order
  await test("Create customer order", async () => {
    assert.ok(menuItemId);

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

    assert.ok([200, 201].includes(r.status), JSON.stringify(r.data));
  });

  // 14. Retrieve orders
  await test("Retrieve orders", async () => {
    const r = await request("/orders", {}, ownerToken);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.ok(Array.isArray(r.data));
  });

  // 15. Mark item unavailable
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

  // 16. Reject unavailable item order
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

  // 17. Restore availability
  await test("Restore menu item availability", async () => {
    const r = await request(`/menu/${menuItemId}`, {
      method: "PATCH",
      body: JSON.stringify({
        isAvailable: true
      })
    }, ownerToken);

    assert.equal(r.status, 200, JSON.stringify(r.data));
  });

  // 18. Daily report
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

  // 19. Cash reconciliation
  await test("Save cash reconciliation", async () => {
    const report = await request(
      `/reports/daily?date=${testDate}`,
      {},
      ownerToken
    );

    assert.equal(report.status, 200, JSON.stringify(report.data));

    const amount = Math.round(Number(report.data.cash_sales || 0));

    // Convert the cash amount into available denominations.
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

  // 20. Reconciliation history
  await test("Retrieve reconciliation history", async () => {
    const r = await request("/reports/reconciliations", {}, ownerToken);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.ok(Array.isArray(r.data));
  });

  // 21. Staff cannot access owner reports
  await test("Staff cannot access daily sales report", async () => {
    const r = await request(
      `/reports/daily?date=${testDate}`,
      {},
      staffToken
    );

    assert.equal(r.status, 403, JSON.stringify(r.data));
  });

  // Summary
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

main().catch(error => {
  console.error("Test suite encountered an unexpected error:", error);
  process.exitCode = 1;
});
