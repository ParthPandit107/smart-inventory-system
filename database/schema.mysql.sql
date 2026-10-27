-- =============================================================================
-- SMART INVENTORY MANAGEMENT SYSTEM - DATABASE SCHEMA (MySQL 8.0+)
-- Storage Engine: InnoDB (Supports ACID Transactions, Foreign Keys, Row Locking)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS smart_inventory_db 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE smart_inventory_db;

-- Disable FK checks during initialization
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. USERS TABLE (Authentication & Role-Based Access Control)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email),
    INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. CATEGORIES TABLE
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS categories;
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_categories_name (name),
    INDEX idx_categories_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. SUPPLIERS TABLE
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS suppliers;
CREATE TABLE suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(30),
    address TEXT,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_suppliers_name (name),
    INDEX idx_suppliers_email (email),
    INDEX idx_suppliers_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. PRODUCTS TABLE
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS products;
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    category_id INT NOT NULL,
    supplier_id INT NOT NULL,
    unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    selling_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    current_stock INT NOT NULL DEFAULT 0,
    min_stock_threshold INT NOT NULL DEFAULT 10,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT,
    CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE RESTRICT,
    CONSTRAINT chk_products_cost CHECK (unit_cost >= 0),
    CONSTRAINT chk_products_price CHECK (selling_price >= 0),
    CONSTRAINT chk_products_stock CHECK (current_stock >= 0),
    CONSTRAINT chk_products_min_stock CHECK (min_stock_threshold >= 0),
    INDEX idx_products_sku (sku),
    INDEX idx_products_name (name),
    INDEX idx_products_category (category_id),
    INDEX idx_products_supplier (supplier_id),
    INDEX idx_products_stock (current_stock),
    INDEX idx_products_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. INVENTORY MOVEMENTS TABLE (Audit Trail for All Stock Changes)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS inventory_movements;
CREATE TABLE inventory_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    movement_type ENUM('STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT') NOT NULL,
    quantity INT NOT NULL,
    previous_stock INT NOT NULL,
    new_stock INT NOT NULL,
    reason TEXT NOT NULL,
    reference_number VARCHAR(100) DEFAULT NULL,
    created_by INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_movements_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
    CONSTRAINT fk_movements_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT chk_movement_quantity CHECK (quantity > 0),
    INDEX idx_movements_product (product_id),
    INDEX idx_movements_type (movement_type),
    INDEX idx_movements_date (created_at),
    INDEX idx_movements_reference (reference_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. PURCHASE ORDERS TABLE
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS purchase_orders;
CREATE TABLE purchase_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_number VARCHAR(50) NOT NULL UNIQUE,
    supplier_id INT NOT NULL,
    order_date DATE NOT NULL,
    expected_delivery_date DATE DEFAULT NULL,
    status ENUM('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_by INT DEFAULT NULL,
    received_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_po_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE RESTRICT,
    CONSTRAINT fk_po_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT chk_po_total CHECK (total_amount >= 0),
    INDEX idx_po_number (po_number),
    INDEX idx_po_supplier (supplier_id),
    INDEX idx_po_status (status),
    INDEX idx_po_order_date (order_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. PURCHASE ORDER ITEMS TABLE
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS purchase_order_items;
CREATE TABLE purchase_order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity_ordered INT NOT NULL,
    unit_cost DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    CONSTRAINT fk_poi_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE CASCADE,
    CONSTRAINT fk_poi_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
    CONSTRAINT chk_poi_quantity CHECK (quantity_ordered > 0),
    CONSTRAINT chk_poi_unit_cost CHECK (unit_cost >= 0),
    INDEX idx_poi_order (purchase_order_id),
    INDEX idx_poi_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. AUDIT LOGS TABLE (System-Wide Operational Audit)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS audit_logs;
CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entity_id INT NULL,
    details TEXT NULL,
    ip_address VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    INDEX idx_audit_entity (entity, entity_id),
    INDEX idx_audit_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable FK checks
SET FOREIGN_KEY_CHECKS = 1;
