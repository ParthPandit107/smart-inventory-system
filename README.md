# 📦 Smart Inventory Management System (SIMS)

A complete, production-grade, relational database-driven **Smart Inventory Management System** built with **Node.js, Express.js, MySQL / SQLite, and Vanilla JavaScript**. Designed for small-to-medium enterprise inventory operations and technical academic/internship evaluation.

---

## 📑 Table of Contents
1. [Project Overview](#-project-overview)
2. [Technology Stack](#-technology-stack)
3. [Architecture Overview](#-architecture-overview)
4. [Relational Database Schema & Relationships](#-relational-database-schema--relationships)
5. [Core Features](#-core-features)
6. [Prerequisites & Installation](#-prerequisites--installation)
7. [Running the Application](#-running-the-application)
8. [Automated Verification Tests (14 Scenarios)](#-automated-verification-tests-14-scenarios)
9. [REST API Endpoint Reference](#-rest-api-endpoint-reference)
10. [Technical Viva Explanations](#-technical-viva-explanations)
11. [Evaluation Demo Sequence (10 Steps)](#-evaluation-demo-sequence-10-steps)
12. [20 Essential Viva Questions & Answers](#-20-essential-viva-questions--answers)
13. [Limitations & Future Roadmap](#-limitations--future-roadmap)

---

## 🎯 Project Overview

In traditional retail and warehousing, manual stock logs cause overselling, stockout delays, and unrecorded discrepancy losses. The **Smart Inventory Management System** solves this by providing:
- **Centralized Product & Vendor Catalog**: Fast search, category filtering, and cost/retail pricing.
- **Strict Concurrency-Safe Stock Movements**: Stock additions (`STOCK_IN`), removals (`STOCK_OUT`), and cycle-count reconciliations (`ADJUSTMENT`) protected by atomic database transactions.
- **Zero Negative Inventory Policy**: Stock can never drop below zero. Overselling is rejected at the database and application boundary.
- **Audit Trails**: Every unit change creates an immutable movement log referencing users, reasons, and purchase orders.
- **Low-Stock Automation**: Detects items where `current_stock <= min_stock_threshold` and suggests reorder quantities based on target buffers.
- **Procurement & Restocking Lifecycle**: Create multi-item purchase orders and receive them in an atomic database transaction that updates stock and logs movements in a single step.
- **Analytical Reporting**: Live inventory asset valuation, gross margins, supplier expenditure, and CSV data export.

---

## 🛠 Technology Stack

| Layer | Technologies Used | Purpose |
| :--- | :--- | :--- |
| **Backend Runtime** | Node.js (v18+) | Non-blocking, event-driven server runtime |
| **Web Framework** | Express.js (v5) | Modular RESTful API routing, middleware pipeline |
| **Primary Database** | MySQL 8.0+ / `mysql2` | ACID transactions, InnoDB engine, row locking (`FOR UPDATE`) |
| **Embedded Relational Fallback**| SQLite 3 / `better-sqlite3` | Zero-config embedded relational engine with strict foreign keys & WAL mode |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` | Password hashing (salt rounds: 10), stateless Bearer auth |
| **Frontend** | HTML5, CSS3, Vanilla ES6+ JS | Enterprise SaaS UI, responsive dashboard, modals, toasts |
| **Testing** | Node.js Native Test Runner (`fetch`) | End-to-end verification of all 14 business scenarios |
| **Data Interchange** | JSON, RFC-4180 CSV Export | REST API payloads & downloadable reports |

---

## 🏛 Architecture Overview

The backend follows a clean **Controller-Service-Repository** modular architectural pattern:

```
smart-inventory-system/
├── database/
│   ├── schema.mysql.sql        # MySQL 8+ DDL (InnoDB, Foreign Keys, Indexes, Constraints)
│   ├── schema.sqlite.sql       # SQLite DDL (Foreign Keys enabled, Indexes)
│   ├── seed.sql                # Realistic seed data (users, categories, suppliers, products, POs)
│   └── init_db.js              # Database initialization & seeding runner
├── src/
│   ├── config/
│   │   └── database.js         # Unified DB adapter (MySQL connection pool & SQLite WAL mode)
│   ├── middleware/
│   │   ├── auth.js             # JWT verification & role authorization (Admin / Staff)
│   │   ├── errorHandler.js     # Centralized error mapping (400, 404, 409 unique constraints, 500)
│   │   └── requestLogger.js    # Concise HTTP request execution logger
│   ├── validators/
│   │   └── schemas.js          # Input validation schemas for entities & movements
│   ├── controllers/            # HTTP request & response coordinators
│   │   ├── authController.js
│   │   ├── dashboardController.js
│   │   ├── productController.js
│   │   ├── categoryController.js
│   │   ├── supplierController.js
│   │   ├── inventoryController.js
│   │   ├── purchaseOrderController.js
│   │   └── reportController.js
│   ├── services/               # Core business rules, SQL queries & transaction boundaries
│   │   ├── authService.js
│   │   ├── dashboardService.js
│   │   ├── productService.js
│   │   ├── categoryService.js
│   │   ├── supplierService.js
│   │   ├── inventoryService.js
│   │   ├── purchaseOrderService.js
│   │   └── reportService.js
│   ├── utils/
│   │   ├── csvExporter.js      # Escaped CSV table generation utility
│   │   └── responseHelper.js   # Standardized JSON response envelope
│   ├── routes/                 # Express route definitions under /api
│   │   ├── index.js            # API router mount & /api/health
│   │   └── ...
│   ├── app.js                  # Express application setup, static files, SPA routing
│   └── server.js               # HTTP listener & startup orchestrator
├── public/                     # Frontend client Single Page Application (SPA)
│   ├── index.html              # Modern dashboard layout & accessible modals
│   ├── css/styles.css          # SaaS design system, responsive flexbox/grid layout
│   └── js/                     # Modular frontend controllers (api, products, inventory, reports, etc.)
├── tests/
│   └── test_scenarios.js       # Comprehensive test runner testing 14 technical scenarios
├── postman_collection.json     # Ready-to-import Postman v2.1 collection
├── .env.example                # Sample environment variables
├── .env                        # Local environment configuration
└── package.json
```

---

## 🗄 Relational Database Schema & Relationships

```
+------------------+         +--------------------------+         +------------------+
|    categories    | 1     * |         products         | *     1 |    suppliers     |
+------------------+---------+--------------------------+---------+------------------+
| id (PK)          |         | id (PK)                  |         | id (PK)          |
| name (UNIQUE)    |         | sku (UNIQUE)             |         | name             |
| description      |         | name                     |         | contact_person   |
| is_active        |         | category_id (FK)         |         | email (INDEX)    |
| created_at       |         | supplier_id (FK)         |         | phone, address   |
+------------------+         | unit_cost                |         | is_active        |
                             | selling_price            |         +------------------+
                             | current_stock (CHECK>=0) |                   | 1
                             | min_stock_threshold      |                   |
                             | is_active                |                   | *
                             +--------------------------+         +------------------+
                                  | 1              | 1            | purchase_orders  |
                                  |                |              +------------------+
                                  | *              | *            | id (PK)          |
             +-------------------------+      +----------------+  | po_number (UNQ)  |
             |   inventory_movements   |      | purchase_items |  | supplier_id (FK) |
             +-------------------------+      +----------------+  | status (ORDERED, |
             | id (PK)                 |      | id (PK)        |  |         RECEIVED)|
             | product_id (FK)         |      | po_id (FK)-----+--| total_amount     |
             | movement_type           |      | product_id (FK)|  | received_at      |
             | quantity (> 0)          |      | quantity       |  +------------------+
             | previous_stock          |      | unit_cost      |
             | new_stock               |      | total_price    |
             | reason, reference_number|      +----------------+
             | created_by (FK users)   |
             +-------------------------+
```

### Table Definitions & Constraints:
1. **`users`**: Administrative and warehouse staff credentials. `email` and `username` have `UNIQUE` constraints. Passwords stored strictly as bcrypt hashes.
2. **`categories`**: Product classifications. `name` is unique to prevent duplicate categories.
3. **`suppliers`**: Vendor registry. Indexed by `email` and `name`.
4. **`products`**: Central inventory catalog.
   - `sku` is globally unique.
   - `category_id` references `categories.id` (`ON DELETE RESTRICT`).
   - `supplier_id` references `suppliers.id` (`ON DELETE RESTRICT`).
   - Check constraint `CHECK (current_stock >= 0)` guarantees no negative stock.
   - Separate indexes on `sku`, `category_id`, `supplier_id`, `current_stock`, and `is_active`.
5. **`inventory_movements`**: Immutable audit logs. References `product_id` and `created_by` (`users.id`). Records movement type (`STOCK_IN`, `STOCK_OUT`, `ADJUSTMENT`), quantity, before & after balances, reference number, and business reason.
6. **`purchase_orders`**: Procurement records. `po_number` is unique. Status enum: `DRAFT`, `ORDERED`, `RECEIVED`, `CANCELLED`.
7. **`purchase_order_items`**: Line items per order. Line subtotals and totals are computed strictly on the backend. Cascades on order deletion.

---

## ⚡ Core Features

- **Dashboard**:
  - Live KPI statistics: Active Products, Total Stored Units, Cost-Basis Valuation, Retail Asset Value, Low-Stock Count, Out-of-Stock Count, Pending POs.
  - Visual stock health progress distribution (Healthy vs. Low vs. Out of Stock).
  - Live feeds of recent stock movements and recently cataloged items.
- **Product Management**:
  - Paginated data table with search by name/SKU, category filtering, and stock status filters.
  - Multi-column sorting (`SKU`, `Name`, `Stock`, `Unit Cost`, `Selling Price`).
  - Create and edit modals with validation.
  - **Stock Protection**: `current_stock` cannot be modified directly via product updates; changes must go through the inventory movement pipeline.
  - Safe deactivation toggle preserving audit integrity. Delete is safely blocked if movement history exists.
- **Stock Movement & Audit Trail**:
  - **Stock In**: Increases product inventory within an atomic transaction and logs movement.
  - **Stock Out**: Checks available quantity, strictly prevents negative inventory (returns 400 Bad Request if requested > available), decreases stock, and logs audit movement.
  - **Manual Adjustment**: For physical audits and cycle counts with mandatory reason logging.
- **Low Stock Detection & Intelligent Reorder Suggestions**:
  - Condition: `current_stock <= min_stock_threshold`.
  - Computes `suggested_reorder_qty = MAX(0, (min_stock_threshold * 2) - current_stock)`.
  - One-click shortcut to launch a restock purchase order with pre-filled quantities.
- **Purchase Order Workflow**:
  - Create multi-item orders.
  - Backend recomputes line totals and total order value.
  - **Atomic Receipt**: Receiving an order increases product stocks, creates `STOCK_IN` movements referencing the PO number, and updates PO status in a single transaction. Prevents duplicate receiving (409 Conflict).
- **Reports & Export**:
  - Valuation report with category margin percentages.
  - Supplier spending breakdown.
  - Stock movement transaction report.
  - Downloadable RFC-4180 CSV export files.

---

## 🚀 Prerequisites & Installation

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MySQL Server** (Optional): If MySQL is installed locally or via XAMPP, you can use it directly. If MySQL is not installed, the application runs on its embedded relational SQLite engine out-of-the-box with full relational integrity and transactions!

### 1. Clone or Open Project
```bash
cd smart-inventory-system
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Contents of `.env`:
```ini
PORT=3000
NODE_ENV=development

# Database Driver: 'sqlite' or 'mysql'
# Set to 'sqlite' for zero-config relational database (data/inventory.db)
# Set to 'mysql' when connecting to a live MySQL / XAMPP server
DB_DRIVER=sqlite
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=smart_inventory_db

# Authentication Secret
JWT_SECRET=inventory_management_secret_jwt_key_2026_secure
JWT_EXPIRES_IN=24h
```

### 4. Initialize Database
Initialize tables and realistic seed data:
```bash
npm run init-db:force
```

---

## 💻 Running the Application

### Start Backend & Serve Frontend
```bash
npm start
```

Open your browser at:
👉 **`http://localhost:3000`**

### Pre-Seeded Evaluation Accounts
| Role | Username | Password | Access Capabilities |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin123` | Full access: CRUD products, categories, suppliers, stock movements, PO receiving, reports |
| **Inventory Staff** | `staff` | `staff123` | Warehouse access: View inventory, record stock in/out, adjustments, view POs |

---

## 🧪 Automated Verification Tests (14 Scenarios)

The project includes an end-to-end verification script testing all 14 mandatory technical scenarios specified in the requirements.

To run the automated tests:
```bash
npm test
```

### Verification Scenarios Tested:
1. ✅ **Create a valid product**: Verifies insertion, SKU uppercase normalization, and opening stock log.
2. ✅ **Attempt duplicate SKU**: Confirms database and service reject duplicate SKU with `HTTP 409 Conflict`.
3. ✅ **Retrieve and update product**: Verifies fetching by ID and detail updating.
4. ✅ **Search and filter products**: Tests search by SKU substring and stock level filtering.
5. ✅ **Add stock (Stock-In)**: Verifies atomic stock increase and resulting quantity.
6. ✅ **Remove stock (Stock-Out)**: Verifies stock deduction and audit record creation.
7. ✅ **Attempt to remove more stock than available**: Confirms overselling is blocked with `HTTP 400 Bad Request` and stock is unchanged.
8. ✅ **Confirm failed stock operations do NOT create movement records**: Verifies movement table count remains unchanged on failure.
9. ✅ **Verify low-stock alerts appear at correct threshold**: Tests alert trigger when `current_stock <= min_stock_threshold` and validates suggested reorder quantity.
10. ✅ **Create a purchase order and receive it**: Tests multi-item order creation and atomic receipt updating product stock.
11. ✅ **Attempt to receive same purchase order twice**: Confirms second receipt attempt is rejected with `HTTP 409 Conflict`.
12. ✅ **Confirm transaction rollback on failure**: Validates that failed operations leave product stock completely unchanged.
13. ✅ **Test invalid product IDs and malformed inputs**: Verifies non-existent IDs return `404` and non-numeric IDs return `400`.
14. ✅ **Verify dashboard totals match database**: Confirms dashboard API numbers match direct SQL count and valuation queries.

---

## 📡 REST API Endpoint Reference

All endpoints are prefixed with `/api`.

### Health & Analytics
- `GET /api/health` — Service health check & active database driver status
- `GET /api/dashboard/summary` — Aggregate metrics, stock breakdown, and recent activity

### Authentication
- `POST /api/auth/login` — Authenticate with `username` and `password`, returns JWT
- `GET /api/auth/me` — Retrieve current authenticated user profile (`Bearer <token>`)

### Products
- `GET /api/products` — List products (query: `page`, `limit`, `search`, `category_id`, `stock_status`, `sortBy`, `order`)
- `GET /api/products/:id` — Get product by ID with category, supplier, and recent movements
- `POST /api/products` — Create a product (validates unique SKU, non-negative prices)
- `PUT /api/products/:id` — Update product details (direct modification of `current_stock` is blocked!)
- `PATCH /api/products/:id/status` — Soft activate/deactivate product
- `DELETE /api/products/:id` — Delete product (safely blocked if historical movements exist)

### Categories
- `GET /api/categories` — List categories with product counts and valuation
- `GET /api/categories/:id` — Get category details and associated product list
- `POST /api/categories` — Create category (validates unique name)
- `PUT /api/categories/:id` — Update category name and description
- `PATCH /api/categories/:id/status` — Deactivate category

### Suppliers
- `GET /api/suppliers` — List suppliers with active product counts
- `GET /api/suppliers/:id` — Get supplier details and supplied product catalog
- `POST /api/suppliers` — Create supplier (validates email)
- `PUT /api/suppliers/:id` — Update supplier details
- `PATCH /api/suppliers/:id/status` — Deactivate supplier

### Inventory & Stock Movements
- `GET /api/inventory/low-stock` — List products where `current_stock <= min_stock_threshold`
- `GET /api/inventory/movements` — Paginated movement history (query: `movementType`, `startDate`, `endDate`)
- `POST /api/inventory/stock-in` — Add stock atomically (payload: `product_id`, `quantity`, `reason`, `reference_number`)
- `POST /api/inventory/stock-out` — Remove stock atomically (validates available stock; rejects negative balance)
- `POST /api/inventory/adjustments` — Reconcile count with physical audit (payload: `product_id`, `new_stock`, `reason`)

### Purchase Orders & Restocking
- `GET /api/purchase-orders` — List purchase orders (query: `status`, `supplierId`, `page`)
- `GET /api/purchase-orders/:id` — View PO header and line items with product details
- `POST /api/purchase-orders` — Create multi-item PO (computes subtotals on server)
- `POST /api/purchase-orders/:id/receive` — Atomic order receipt (increases stock, logs movements, sets `RECEIVED`)
- `POST /api/purchase-orders/:id/cancel` — Cancel pending order

### Reports & CSV Export
- `GET /api/reports/inventory` — Stock levels, cost valuation, retail value, projected margin
- `GET /api/reports/valuation` — Category valuation breakdown and gross margin percentages
- `GET /api/reports/movements` — Aggregated transaction counts and volumes
- `GET /api/reports/suppliers` — Supplier expenditure and inventory holding
- `GET /api/reports/export.csv?type={inventory|low_stock|movements|valuation|suppliers}` — Download RFC-4180 CSV

---

## 💡 Technical Viva Explanations

### 1. How a Stock Update Flows Through the System
1. **Client Request**: The frontend or API client sends `POST /api/inventory/stock-out` with `{ product_id: 1, quantity: 5, reason: "Customer Dispatch" }` and an Authorization Bearer token.
2. **Authentication & Validation Middleware**: `auth.js` verifies the JWT token and attaches `req.user`. `schemas.js` verifies that `product_id` and `quantity` are positive integers.
3. **Transaction Initiation**: The service requests a dedicated database connection (`db.getConnection()`) and begins an atomic transaction (`conn.beginTransaction()`).
4. **Row-Level Lock**: The service queries `SELECT current_stock FROM products WHERE id = ? FOR UPDATE`. This places an exclusive write lock on that specific row, preventing concurrent transactions from reading stale stock numbers.
5. **Business Rule Enforcement**: The service checks if `current_stock >= quantity`. If the stock is insufficient, it rolls back the transaction and throws an error with HTTP status 400.
6. **Stock Update & Audit Record**: The service executes `UPDATE products SET current_stock = current_stock - ?` and inserts a new audit log into `inventory_movements`.
7. **Commit**: `conn.commit()` is called. The lock is released, and the connection is returned to the pool.
8. **Response**: A standardized 200 JSON response is returned to the client with previous and new stock quantities.

### 2. How Database Transactions Guarantee Consistency (ACID)
- **Atomicity**: The product quantity update and the movement audit record must both succeed. If an unexpected server failure or constraint error occurs between the two operations, `conn.rollback()` restores the database to its exact prior state.
- **Consistency**: Relational constraints (e.g. `CHECK (current_stock >= 0)` and foreign keys) ensure data remains in a valid state throughout.
- **Isolation**: Row locking (`FOR UPDATE`) isolates simultaneous transactions from each other, preventing race conditions.
- **Durability**: Once `conn.commit()` completes, the transaction is written to persistent storage (Write-Ahead Logging / redo log).

### 3. Why Foreign Keys and Indexes Are Used
- **Foreign Keys**: Enforce referential integrity. For example, a product cannot reference a non-existent `category_id` or `supplier_id`. Using `ON DELETE RESTRICT` prevents accidental deletion of a category or supplier that still has active products.
- **Indexes**: Without an index on `sku`, finding a product requires a Full Table Scan ($O(N)$ operations). A B-Tree index on `sku` reduces lookup time to $O(\log N)$. Indexes are also placed on `category_id`, `supplier_id`, and `created_at` for rapid filtering and sorting.

### 4. How Concurrency and Overselling Are Handled
If two users simultaneously request 5 units of a product that has only 6 units remaining:
Without row locking, both requests might read `current_stock = 6`, approve the sale, and decrement the stock to $-4$ (the classic "lost update" anomaly).
With `SELECT ... FOR UPDATE` (or `BEGIN IMMEDIATE` transaction locking in SQLite), the first transaction locks the product row. The second transaction must wait until the first commits. When the second transaction acquires the lock, it reads the updated balance of 1 unit, detects that 5 units cannot be fulfilled, and returns a clean 400 Bad Request error.

---

## 🎬 Evaluation Demo Sequence (10 Steps)

Prepare to walk your evaluator or viva examiner through this sequence:
1. **Dashboard Walkthrough**: Open `http://localhost:3000`. Point out the real database metrics: Active Products, Total Valuation (computed via `SUM(current_stock * unit_cost)`), Low-Stock count, and the Stock Health Distribution progress bars.
2. **Product Catalog & Filtering**: Navigate to **Products**. Demonstrate search by name and SKU, filter by category, and sort by price.
3. **Product Creation & Duplicate SKU Rejection**: Click "Add Product". Create a product with SKU `DEMO-SKU-01`. Then try to create another product with the exact same SKU; show the evaluator the `HTTP 409 Conflict` error dialog.
4. **Stock-In Operation**: Click "Stock Movements" -> "Stock In". Add 20 units to `DEMO-SKU-01` with reference `PO-DEMO`. Show the updated stock quantity and the instant audit log created in the movements table.
5. **Stock-Out & Negative Stock Protection**: Click "Stock Out". First dispatch 5 units. Then attempt to dispatch 500 units; show the examiner that the system refuses the transaction with `Insufficient inventory. Stock cannot be negative.`
6. **Triggering Low-Stock Alert**: Open **Low Stock Alerts**. Show how items whose `current_stock <= min_stock_threshold` are highlighted, along with the automated **Suggested Reorder Quantity** formula (`Target 2× Threshold - Current Stock`).
7. **Purchase Order Restocking**: Go to **Purchase Orders**. Create a PO with 2 items. Click **Receive Order**. Explain to the examiner that receiving the PO runs an atomic database transaction that increments product stock and creates `STOCK_IN` movement logs.
8. **Duplicate PO Receipt Prevention**: Click "Receive" again on the same PO; show that the system detects it is already received and prevents double-counting.
9. **SQL Aggregation & CSV Export**: Go to **Reports & CSV**. Show the category margin breakdown calculated using SQL `GROUP BY` and `ROUND()`. Click **Download CSV** to demonstrate real file export.
10. **Explain SQL Schema & Transaction in Code**: Open `src/services/inventoryService.js` and `database/schema.mysql.sql` in your editor and explain the `BEGIN`, `FOR UPDATE`, and `COMMIT/ROLLBACK` blocks.

---

## ❓ 20 Essential Viva Questions & Answers

#### Q1: What is the difference between a Primary Key and a Foreign Key?
**Answer**: A Primary Key uniquely identifies each record in a table and cannot contain `NULL` values. A Foreign Key is a field in one table that references the Primary Key of another table, establishing a referential relationship between the two entities.

#### Q2: What are the ACID properties in database management?
**Answer**:
- **Atomicity**: All operations in a transaction succeed or all fail together.
- **Consistency**: Data transitions from one valid state to another without violating constraints.
- **Isolation**: Concurrent transactions execute without interfering with one another.
- **Durability**: Committed data is permanently saved to storage even during a crash.

#### Q3: Why did you use `DECIMAL(12,2)` instead of `FLOAT` or `DOUBLE` for prices?
**Answer**: `FLOAT` and `DOUBLE` use binary floating-point representation (IEEE 754), which causes rounding errors in decimal arithmetic (e.g., $0.1 + 0.2 \neq 0.3$). `DECIMAL` stores numbers as exact fixed-point decimals, which is mandatory for financial and monetary calculations.

#### Q4: How does your system prevent negative stock?
**Answer**: Through two layers of defense:
1. **Application Layer**: In `inventoryService.js`, the service checks `if (previousStock < quantity)` and throws an error before executing the update.
2. **Database Layer**: The MySQL/SQLite schema defines `CONSTRAINT chk_products_stock CHECK (current_stock >= 0)`.

#### Q5: What is the purpose of `SELECT ... FOR UPDATE`?
**Answer**: It establishes an exclusive row-level lock on the selected records. Any concurrent transaction attempting to read or update the same rows is blocked until the locking transaction commits or rolls back, preventing race conditions and lost updates.

#### Q6: What is a "Soft Delete" and why is it preferred for products?
**Answer**: A soft delete updates an `is_active` flag from `1` to `0` instead of executing a `DELETE` query. This preserves historical referential integrity: previous purchase orders and inventory movement logs continue to reference the product without foreign key violations.

#### Q7: How does your system calculate Total Inventory Valuation?
**Answer**: Using an aggregate SQL query: `SELECT SUM(current_stock * unit_cost) FROM products WHERE is_active = 1`. This calculates the cost-basis value in the database engine rather than loading all rows into JavaScript memory.

#### Q8: What is the difference between `INNER JOIN` and `LEFT JOIN`?
**Answer**: `INNER JOIN` returns only rows that have matching values in both tables. `LEFT JOIN` returns all rows from the left table, along with matched values from the right table, or `NULL` if no match exists (e.g., listing all categories even if they have 0 products).

#### Q9: What is a Database Connection Pool?
**Answer**: Creating a new TCP database connection for every incoming HTTP request is expensive. A connection pool maintains a cache of reusable database connections. When a request arrives, it borrows a connection, executes queries, and returns it to the pool.

#### Q10: How do you prevent SQL Injection in Node.js?
**Answer**: By using parameterized queries with question mark placeholders (`?`). The database driver compiles the SQL query structure first, and treats user inputs strictly as literal values rather than executable code.

#### Q11: What is database normalization?
**Answer**: The process of organizing schema tables to reduce data redundancy and eliminate update/delete anomalies. For instance, supplier details are stored in a dedicated `suppliers` table rather than repeated inside every product row (Third Normal Form - 3NF).

#### Q12: Why did you use JWT for authentication?
**Answer**: JSON Web Tokens provide stateless authentication. The server issues a cryptographically signed token containing the user's ID and role. The server does not need to store active session state in memory, making the API scalable and easily testable via Postman.

#### Q13: Why is bcrypt preferred over SHA-256 or MD5 for password storage?
**Answer**: SHA-256 and MD5 are fast cryptographic hashes designed for throughput, making them vulnerable to brute-force and rainbow table attacks. `bcrypt` incorporates salting and a configurable work factor (key derivation rounds), making brute-force attacks computationally infeasible.

#### Q14: What is the suggested reorder quantity formula used in your system?
**Answer**: $\text{Suggested Reorder} = \max(0, (\text{min\_stock\_threshold} \times 2) - \text{current\_stock})$. It calculates the exact quantity needed to bring inventory back to a safe buffer level of double the minimum threshold.

#### Q15: What HTTP status code is used when a duplicate SKU is submitted?
**Answer**: `HTTP 409 Conflict`. It informs the client that the request cannot be processed because it conflicts with the current state of a unique resource in the database.

#### Q16: How does receiving a Purchase Order affect the database?
**Answer**: It executes within an atomic transaction:
1. Validates PO status is `ORDERED`.
2. Loops through order items, updates each product's `current_stock`.
3. Inserts a `STOCK_IN` movement into `inventory_movements` referencing the PO.
4. Updates PO status to `RECEIVED` and sets `received_at`.
5. Commits all changes together.

#### Q17: What does the Write-Ahead Logging (WAL) mode do in SQLite?
**Answer**: In standard rollback journal mode, writers block readers. In WAL mode, changes are appended to a separate `-wal` file. Readers can access the database simultaneously while a writer is writing, dramatically improving concurrent read/write throughput.

#### Q18: Why is pagination essential for product listings?
**Answer**: Loading thousands of product records into a single HTTP response consumes excessive database memory, network bandwidth, and frontend rendering time. Pagination (`LIMIT ? OFFSET ?`) retrieves only a fixed batch of records per page.

#### Q19: What is an index and when should you avoid creating one?
**Answer**: An index is a specialized data structure (typically a B-Tree) that speeds up data retrieval on indexed columns. You should avoid indexing columns that are frequently updated, columns on very small tables, or columns with very low cardinality (e.g. a boolean flag on a massive table), because indexes incur write overhead on every `INSERT`, `UPDATE`, and `DELETE`.

#### Q20: What happens if a server crashes midway through a stock-out operation?
**Answer**: The database transaction is rolled back upon recovery. Because `COMMIT` was never reached, neither the stock decrement nor the movement log persists, ensuring the database never enters a corrupt or half-updated state.

---

## 📋 Limitations & Future Roadmap

### Current Version Scope:
- Single-warehouse inventory tracking (central facility).
- Relational schema with full transactional ACID guarantees.
- JWT-based authentication for Admin and Staff roles.
- Dual-driver support: MySQL and embedded SQLite.

### Future Roadmap:
- **Multi-Warehouse Support**: Tracking stock by specific warehouse locations, bins, and inter-facility stock transfers.
- **Barcode & QR Scanning**: Native integration with handheld barcode scanners or webcam scanning for instant SKU lookups.
- **Automated Supplier Email Alerts**: Automatically email PO PDFs to suppliers when low-stock thresholds are triggered.
- **Role-Based Fine Permissions**: Granular ACL permissions per warehouse department.

---

### 👨‍💻 Developer & Evaluation Notes
- **Author**: Student Full-Stack Developer
- **Evaluation Target**: College Internship Evaluation / Technical Capstone
- **Tested Environment**: Windows 11, Node.js v24.19.0, npm v11.17.0
- **License**: MIT
