import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/app.js";

test("GET /api/health returns API status", async () => {
  const server = app.listen(0);
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok", service: "pojangmacha-api" });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("unknown route returns 404 JSON", async () => {
  const server = app.listen(0);
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/not-a-route`);
    assert.equal(response.status, 404);
    assert.match((await response.json()).message, /Route not found/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
