# Pojangmacha Order and Sales Logging System — Backend

Backend API using Node.js, Express, PostgreSQL (`pg`), and JWT. This implementation uses raw SQL and `db/schema.sql`.

## Requirements
- Node.js 20+
- PostgreSQL 14+
- npm

## Setup
1. Create a PostgreSQL database named `pojangmacha_pos`.
2. Update `.env` with your PostgreSQL password and a random JWT secret (at least 32 characters).
3. Install packages:
      bash 
   npm install
   
4. Create tables:
      bash
   npm run db:init

5. Create the first OWNER account (see below).
6. Start:
      bash
   npm run dev
  

API base URL: `http://localhost:5000/api`

## Create the first owner
For safety, public registration is disabled. Create the initial owner once in a terminal from this folder:
    bash
node --input-type=module

Then paste:
    js
import "dotenv/config";
import bcrypt from "bcryptjs";
import pool from "./src/config/db.js";
const passwordHash = await bcrypt.hash("ChooseAStrongPassword123!", 12);
await pool.query(
  "INSERT INTO users(full_name,email,password_hash,role) VALUES($1,$2,$3,'OWNER')",
  ["Store Owner", "owner@example.com", passwordHash]
);
await pool.end();

Replace the sample name, email and password. Do not commit real credentials.

## API routes

All routes except health and login require `Authorization: Bearer <token>` where indicated.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Health check |
| POST | `/api/auth/login` | Public | Login |
| POST | `/api/auth/register` | Public, disabled | Registration intentionally blocked |
| GET | `/api/auth/me` | Signed-in | Current account |
| GET | `/api/auth/users` | Owner | List users |
| POST | `/api/auth/users` | Owner | Create staff/owner account |
| GET | `/api/menu` | Signed-in | List menu |
| POST | `/api/menu` | Owner | Create menu item |
| PATCH | `/api/menu/:id` | Owner | Edit item / availability |
| GET | `/api/menu/categories` | Signed-in | List categories |
| POST | `/api/menu/categories` | Owner | Create category |
| GET | `/api/orders` | Signed-in | List orders (staff sees own) |
| POST | `/api/orders` | Signed-in | Save order |
| GET | `/api/reports/daily?date=YYYY-MM-DD` | Owner | Daily sales |
| GET | `/api/reports/reconciliations` | Owner | Reconciliation history |
| POST | `/api/reports/reconciliations` | Owner | Save cash count |

## Create order request
    json
{
  "items": [
    { "menuItemId": 1, "quantity": 2 }
  ],
  "paymentMethod": "CASH"
}

`paymentMethod` accepts `CASH` or `INSTAPAY`. InstaPay is only recorded; this system does not process it. Order rows, item snapshots and payment are committed in one SQL transaction.

## Frontend integration note
The frontend should call `/api/menu` (not `/api/products`) and send `menuItemId` (not `productId`) in order requests. Coordinate this API contract with your frontend partner. Set `CLIENT_ORIGIN` to the frontend's origin.

## Scope
No ingredient inventory, supplier ordering, online orders, delivery, InstaPay processing, payroll, employee scheduling or accounting reports. Historical item names and prices are snapshotted in `order_items`.
