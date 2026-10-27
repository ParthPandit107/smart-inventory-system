-- =============================================================================
-- SMART INVENTORY MANAGEMENT SYSTEM - DATABASE SCHEMA (SQLite Embedded Relational)
-- Enforces Foreign Keys, Unique Constraints, Check Constraints, and Indexes
-- =============================================================================

PRAGMA foreign_keys = ON;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- 2. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories (name);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories (is_active);

-- 3. SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers (name);
CREATE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers (email);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers (is_active);

-- 4. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category_id INTEGER NOT NULL,
    supplier_id INTEGER NOT NULL,
    unit_cost REAL NOT NULL DEFAULT 0.00 CHECK (unit_cost >= 0),
    selling_price REAL NOT NULL DEFAULT 0.00 CHECK (selling_price >= 0),
    current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    min_stock_threshold INTEGER NOT NULL DEFAULT 10 CHECK (min_stock_threshold >= 0),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products (supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products (current_stock);
CREATE INDEX IF NOT EXISTS idx_products_active ON products (is_active);

-- 5. INVENTORY MOVEMENTS TABLE
CREATE TABLE IF NOT EXISTS inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    reason TEXT NOT NULL,
    reference_number TEXT DEFAULT NULL,
    created_by INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_movements_product ON inventory_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_movements_type ON inventory_movements (movement_type);
CREATE INDEX IF NOT EXISTS idx_movements_date ON inventory_movements (created_at);
CREATE INDEX IF NOT EXISTS idx_movements_reference ON inventory_movements (reference_number);

-- 6. PURCHASE ORDERS TABLE
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_number TEXT NOT NULL UNIQUE,
    supplier_id INTEGER NOT NULL,
    order_date DATE NOT NULL,
    expected_delivery_date DATE DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED')),
    total_amount REAL NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    notes TEXT,
    created_by INTEGER DEFAULT NULL,
    received_at DATETIME NULL DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_po_number ON purchase_orders (po_number);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders (supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders (status);

-- 7. PURCHASE ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered > 0),
    unit_cost REAL NOT NULL CHECK (unit_cost >= 0),
    total_price REAL NOT NULL,
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_poi_order ON purchase_order_items (purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_poi_product ON purchase_order_items (product_id);

-- 8. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER NULL,
    details TEXT NULL,
    ip_address TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs (created_at);
