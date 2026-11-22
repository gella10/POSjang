
# Pojangmacha Order and Sales System

A Point of Sale (POS) and Sales Monitoring System frontend built with React + Vite for Pojangmacha, a Korean street food business.

## User Roles (Strictly Two Roles)

**OWNER:** Full store management — dashboard metrics, menu management (add, edit, activate or deactivate products), inventory tracking and stock updates, automatic low-stock alerts, order processing, sales and order history, and account profile management.

**STAFF:** Staff login, menu browsing, adding items to the current order, dine-in or take-out with table number, payment processing (Cash or G-Cash), order checkout and confirmation, sales and order history viewing, and account profile management.

## Demo Login Credentials

**Owner Portal:**
- Email: owner@pojang.com
- Password: pojang123

**Staff Portal:**
- Email: demo@pojang.test
- Password: demo123

## Installation & Running

### 1. Install Dependencies

```bash
npm install
```

### 2. Copy Environment Variables

(Optional for local defaults)

```bash
cp .env.example .env
```

### 3. Start the Vite Development Server

```bash
npm run dev
```

### 4. Build for Production

```bash
npm run build
```

### 5. Preview the Production Build

```bash
npm run preview
```

## Connecting the Frontend to the API

The frontend communicates with the REST API through the address configured in `VITE_API_URL`.

To connect the frontend to the API in production:

1. Set `VITE_API_URL` in your `.env` file to the live API address (refer to `.env.example`).
2. Deploy the frontend (e.g., Netlify) and add `VITE_API_URL` in the hosting platform's environment variable settings.
3. Rebuild and redeploy the site so the updated API address is applied.
4. Ensure that the backend API is running and accessible.
5. Keep every real secret out of the repository; only fake or placeholder values should be included in `.env.example`.

## Technology Stack

- **Frontend:** React.js
- **Build Tool:** Vite
- **Programming Language:** JavaScript
- **Styling:** CSS
- **API Communication:** REST API

## Main Features

### Owner Interface
- Dashboard metrics
- Menu management
- Add and edit products
- Activate or deactivate menu items
- Inventory tracking
- Stock updates
- Automatic low-stock alerts
- Order processing
- Sales monitoring
- Sales and order history
- Account profile management

### Staff Interface
- Staff login
- Menu browsing
- Add items to current order
- Dine-in and take-out options
- Table number assignment
- Cash and G-Cash payment processing
- Order checkout and confirmation
- Sales and order history viewing
- Account profile management

## Project Purpose

The Pojangmacha Order and Sales System aims to simplify daily restaurant operations by providing an organized point-of-sale system, efficient order processing, inventory monitoring, and sales tracking. It helps the owner manage the business while allowing staff to process customer orders and payments efficiently.
