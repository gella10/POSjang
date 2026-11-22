
-- =========================================================
-- KOREAN INSTANT NOODLE POS SYSTEM
-- Database: PostgreSQL
-- =========================================================


-- =========================================================
-- 1. USERS
-- Owner and staff accounts
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,

    role VARCHAR(10) NOT NULL DEFAULT 'STAFF'
        CHECK (role IN ('OWNER', 'STAFF')),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 2. PASSWORD RESET TOKENS
-- Used for password reset functionality
-- =========================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user
ON password_reset_tokens(user_id);


-- =========================================================
-- 3. CATEGORIES
-- Examples: Ramyeon, Rice Meals, Drinks, Add-ons
-- =========================================================

CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 4. MENU ITEMS
-- Cooked instant noodle dishes and other menu products
-- =========================================================

CREATE TABLE IF NOT EXISTS menu_items (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(160) NOT NULL,
    description TEXT,

    price NUMERIC(10,2) NOT NULL
        CHECK (price >= 0),

    category_id BIGINT
        REFERENCES categories(id) ON DELETE SET NULL,

    is_available BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category
ON menu_items(category_id);


-- =========================================================
-- 5. COMBOS
-- Bundled menu items sold together
-- =========================================================

CREATE TABLE IF NOT EXISTS combos (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(80) NOT NULL UNIQUE,
    description TEXT,

    price NUMERIC(10,2) NOT NULL
        CHECK (price >= 0),

    is_available BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 6. COMBO ITEMS
-- Defines which menu items belong to a combo
-- =========================================================

CREATE TABLE IF NOT EXISTS combo_items (
    id BIGSERIAL PRIMARY KEY,

    combo_id BIGINT NOT NULL
        REFERENCES combos(id) ON DELETE CASCADE,

    menu_item_id BIGINT NOT NULL
        REFERENCES menu_items(id) ON DELETE RESTRICT,

    quantity INTEGER NOT NULL DEFAULT 1
        CHECK (quantity > 0),

    UNIQUE (combo_id, menu_item_id)
);


-- =========================================================
-- 7. INVENTORY ITEMS
-- Ingredients and supplies used by the store
--
-- Examples:
-- Instant noodle packets
-- Eggs
-- Cheese
-- Spam
-- Sausage
-- Dumplings
-- Vegetables
-- =========================================================

CREATE TABLE IF NOT EXISTS inventory_items (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(160) NOT NULL UNIQUE,

    unit VARCHAR(30) NOT NULL,
    -- Examples: pcs, packs, grams, ml

    stock_quantity NUMERIC(12,3) NOT NULL DEFAULT 0
        CHECK (stock_quantity >= 0),

    reorder_level NUMERIC(12,3) NOT NULL DEFAULT 0
        CHECK (reorder_level >= 0),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 8. MENU ITEM INGREDIENTS
-- Recipe for each cooked menu item
--
-- Example:
-- One noodle dish requires:
-- 1 noodle pack
-- 1 egg
-- 20 grams of cheese
-- =========================================================

CREATE TABLE IF NOT EXISTS menu_item_ingredients (
    id BIGSERIAL PRIMARY KEY,

    menu_item_id BIGINT NOT NULL
        REFERENCES menu_items(id) ON DELETE CASCADE,

    inventory_item_id BIGINT NOT NULL
        REFERENCES inventory_items(id) ON DELETE RESTRICT,

    quantity_required NUMERIC(12,3) NOT NULL
        CHECK (quantity_required > 0),

    UNIQUE (menu_item_id, inventory_item_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_menu_item
ON menu_item_ingredients(menu_item_id);

CREATE INDEX IF NOT EXISTS idx_recipe_inventory
ON menu_item_ingredients(inventory_item_id);


-- =========================================================
-- 9. ADD-ON OPTIONS
-- Optional toppings customers can purchase
--
-- Examples:
-- Extra egg
-- Extra cheese
-- Extra spam
-- =========================================================

CREATE TABLE IF NOT EXISTS add_on_options (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(100) NOT NULL UNIQUE,

    inventory_item_id BIGINT NOT NULL
        REFERENCES inventory_items(id) ON DELETE RESTRICT,

    quantity_required NUMERIC(12,3) NOT NULL
        CHECK (quantity_required > 0),

    additional_price NUMERIC(10,2) NOT NULL DEFAULT 0
        CHECK (additional_price >= 0),

    is_available BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 10. MENU ITEM ADD-ON OPTIONS
-- Controls which add-ons are available for each dish
-- =========================================================

CREATE TABLE IF NOT EXISTS menu_item_add_on_options (
    id BIGSERIAL PRIMARY KEY,

    menu_item_id BIGINT NOT NULL
        REFERENCES menu_items(id) ON DELETE CASCADE,

    add_on_option_id BIGINT NOT NULL
        REFERENCES add_on_options(id) ON DELETE CASCADE,

    UNIQUE (menu_item_id, add_on_option_id)
);


-- =========================================================
-- 11. ORDERS
-- Main sales transaction records
-- =========================================================

CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,

    order_number VARCHAR(40) NOT NULL UNIQUE,

    total NUMERIC(10,2) NOT NULL
        CHECK (total >= 0),

    status VARCHAR(12) NOT NULL DEFAULT 'COMPLETED'
        CHECK (status IN ('COMPLETED', 'VOIDED')),

    staff_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    order_type VARCHAR(20) NOT NULL DEFAULT 'DINE_IN'
        CHECK (order_type IN ('DINE_IN', 'TAKE_OUT')),

    table_number VARCHAR(30),

    order_notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
ON orders(created_at);

CREATE INDEX IF NOT EXISTS idx_orders_staff
ON orders(staff_id);

CREATE INDEX IF NOT EXISTS idx_orders_status
ON orders(status);


-- =========================================================
-- 12. ORDER ITEMS
-- Individual dishes or combos included in an order
--
-- Snapshot columns preserve the original name and price
-- even if the menu is changed later.
-- =========================================================

CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,

    order_id BIGINT NOT NULL
        REFERENCES orders(id) ON DELETE CASCADE,

    menu_item_id BIGINT
        REFERENCES menu_items(id) ON DELETE SET NULL,

    combo_id BIGINT
        REFERENCES combos(id) ON DELETE SET NULL,

    item_name_snapshot VARCHAR(160) NOT NULL,

    unit_price_snapshot NUMERIC(10,2) NOT NULL
        CHECK (unit_price_snapshot >= 0),

    quantity INTEGER NOT NULL
        CHECK (quantity > 0),

    line_total NUMERIC(10,2) NOT NULL
        CHECK (line_total >= 0),

    CHECK (
        (menu_item_id IS NOT NULL AND combo_id IS NULL)
        OR
        (menu_item_id IS NULL AND combo_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_order_items_order
ON order_items(order_id);


-- =========================================================
-- 13. ORDER ITEM ADD-ONS
-- Records the optional toppings selected by customers
-- =========================================================

CREATE TABLE IF NOT EXISTS order_item_add_ons (
    id BIGSERIAL PRIMARY KEY,

    order_item_id BIGINT NOT NULL
        REFERENCES order_items(id) ON DELETE CASCADE,

    add_on_option_id BIGINT
        REFERENCES add_on_options(id) ON DELETE SET NULL,

    add_on_name_snapshot VARCHAR(100) NOT NULL,

    unit_price_snapshot NUMERIC(10,2) NOT NULL
        CHECK (unit_price_snapshot >= 0),

    quantity INTEGER NOT NULL
        CHECK (quantity > 0),

    line_total NUMERIC(10,2) NOT NULL
        CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_addons_order_item
ON order_item_add_ons(order_item_id);


-- =========================================================
-- 14. PAYMENTS
-- Cash and InstaPay payments
-- =========================================================

CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,

    order_id BIGINT NOT NULL UNIQUE
        REFERENCES orders(id) ON DELETE CASCADE,

    method VARCHAR(10) NOT NULL
        CHECK (method IN ('CASH', 'INSTAPAY')),

    amount NUMERIC(10,2) NOT NULL
        CHECK (amount >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_method_created
ON payments(method, created_at);


-- =========================================================
-- 15. INVENTORY TRANSACTIONS
-- Tracks every stock increase or decrease
--
-- Examples:
-- RESTOCK: stock increases
-- SALE: stock decreases
-- WASTE: stock decreases
-- ADJUSTMENT: manual stock correction
-- RETURN: stock increases
--
-- quantity_change is positive for increases
-- and negative for decreases.
-- =========================================================

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id BIGSERIAL PRIMARY KEY,

    inventory_item_id BIGINT NOT NULL
        REFERENCES inventory_items(id) ON DELETE RESTRICT,

    transaction_type VARCHAR(15) NOT NULL
        CHECK (
            transaction_type IN (
                'RESTOCK',
                'SALE',
                'WASTE',
                'ADJUSTMENT',
                'RETURN'
            )
        ),

    quantity_change NUMERIC(12,3) NOT NULL
        CHECK (quantity_change <> 0),

    order_id BIGINT
        REFERENCES orders(id) ON DELETE SET NULL,

    notes TEXT,

    performed_by BIGINT
        REFERENCES users(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item
ON inventory_transactions(inventory_item_id);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created
ON inventory_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_order
ON inventory_transactions(order_id);


-- =========================================================
-- 16. CASH RECONCILIATIONS
-- Records the daily cash count
-- =========================================================

CREATE TABLE IF NOT EXISTS cash_reconciliations (
    id BIGSERIAL PRIMARY KEY,

    business_date DATE NOT NULL UNIQUE,

    recorded_cash_sales NUMERIC(10,2) NOT NULL
        CHECK (recorded_cash_sales >= 0),

    actual_cash NUMERIC(10,2) NOT NULL
        CHECK (actual_cash >= 0),

    difference NUMERIC(10,2) NOT NULL,

    denomination_counts JSONB NOT NULL DEFAULT '{}'::jsonb,

    notes TEXT,

    reconciled_by BIGINT NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- END OF DATABASE SCHEMA
-- =========================================================
