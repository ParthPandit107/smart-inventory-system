-- =============================================================================
-- SMART INVENTORY MANAGEMENT SYSTEM - SEED DATA
-- Default Credentials:
-- Admin: admin / admin123
-- Staff: staff / staff123
-- =============================================================================

-- 1. SEED USERS
INSERT INTO users (id, username, email, password_hash, full_name, role, is_active) VALUES
(1, 'admin', 'admin@inventory.com', '$2b$10$4HMF5EBDN9v9XUnwt0lB0udyFeOIxrhQRDiEIUQPR5xzTrGqsXgR.', 'System Administrator', 'admin', 1),
(2, 'staff', 'staff@inventory.com', '$2b$10$VxD4bisk809AV/VgoQHhU.G8cTzSjPpsqpzMn3nhe3sqpMD.6h5DC', 'Warehouse Operations Staff', 'staff', 1);

-- 2. SEED CATEGORIES
INSERT INTO categories (id, name, description, is_active) VALUES
(1, 'Computer Hardware', 'Processors, memory modules, motherboards, and power supplies', 1),
(2, 'Peripherals & Accessories', 'Keyboards, mice, webcams, and docking stations', 1),
(3, 'Networking Equipment', 'Routers, switches, patch panels, and Cat6 cabling', 1),
(4, 'Office Supplies', 'Ergonomic stands, label printers, packaging, and paper', 1),
(5, 'Audio & Video', 'Headsets, studio microphones, conference cameras, and speakers', 1);

-- 3. SEED SUPPLIERS
INSERT INTO suppliers (id, name, contact_person, email, phone, address, is_active) VALUES
(1, 'TechNova Wholesale', 'Sarah Jenkins', 'sarah@technovawholesale.com', '+1-555-019-2831', '450 Innovation Parkway, San Jose, CA', 1),
(2, 'Apex Hardware Ltd', 'David Chen', 'sales@apexhardware.com', '+1-555-014-9922', '120 Industrial Boulevard, Austin, TX', 1),
(3, 'Global Office Direct', 'Elena Rostova', 'elena@globalofficedirect.com', '+1-555-018-7744', '88 Logistics Way, Chicago, IL', 1),
(4, 'CyberLink Distributors', 'Marcus Brody', 'orders@cyberlinkdist.com', '+1-555-012-3388', '710 Gateway Center, Seattle, WA', 1),
(5, 'SonicWave Acoustics', 'Priya Patel', 'priya@sonicwave.com', '+1-555-016-5511', '33 Soundview Terrace, Boston, MA', 1);

-- 4. SEED PRODUCTS
-- Product inventory states: Healthy, Low Stock, and Out of Stock
INSERT INTO products (id, sku, name, description, category_id, supplier_id, unit_cost, selling_price, current_stock, min_stock_threshold, is_active) VALUES
(1, 'SKU-LOGI-MXM3', 'Logitech MX Master 3S Wireless Mouse', 'Ergonomic performance wireless mouse with 8K DPI sensor', 2, 1, 65.00, 99.99, 45, 10, 1),
(2, 'SKU-KBD-MECH87', 'Tenkeyless Mechanical Keyboard RGB', 'Hot-swappable tactile switches with aluminum top plate', 2, 1, 42.50, 79.99, 8, 15, 1),
(3, 'SKU-RAM-DDR5-32', 'Crucial 32GB Kit DDR5 5600MHz RAM', 'High performance desktop memory for workstations', 1, 2, 78.00, 119.50, 24, 8, 1),
(4, 'SKU-SSD-NVME-2T', 'Samsung 990 PRO 2TB NVMe PCIe 4.0 SSD', 'Read speeds up to 7450 MB/s for creative workloads', 1, 2, 120.00, 179.99, 3, 10, 1),
(5, 'SKU-NET-SW24G', '24-Port Gigabit Managed PoE+ Switch', 'Layer 2 managed switch with 370W PoE power budget', 3, 4, 210.00, 329.00, 6, 5, 1),
(6, 'SKU-NET-RTWIFI6', 'AX5400 Dual-Band Wi-Fi 6 Router', 'Multi-gigabit wireless router for business offices', 3, 4, 85.00, 139.99, 18, 5, 1),
(7, 'SKU-AUD-ANCPRO', 'Active Noise-Cancelling USB-C Headset', 'Crystal-clear boom mic with active noise cancellation', 5, 5, 54.00, 89.95, 4, 12, 1),
(8, 'SKU-VID-4KCAM', 'Ultra HD 4K Pro Streaming Webcam', 'Dual stereo mics and HDR lighting compensation', 5, 5, 95.00, 159.00, 0, 8, 1),
(9, 'SKU-OFF-STAND-AL', 'Aluminum Ergonomic Laptop Stand', 'Foldable 360-degree rotating cooling stand', 4, 3, 16.50, 34.99, 60, 20, 1),
(10, 'SKU-OFF-LBL-PRN', 'Thermal High-Speed Barcode Label Printer', 'Direct thermal commercial-grade label maker', 4, 3, 80.00, 129.99, 2, 6, 1),
(11, 'SKU-CAB-CAT6-1000', 'Cat6 Bulk Ethernet Cable 1000ft Reel', '23 AWG solid copper UTP network cable blue', 3, 4, 98.00, 159.00, 12, 4, 1),
(12, 'SKU-PSU-850W-GLD', '850W Fully Modular 80+ Gold Power Supply', 'ATX 3.0 power supply with 135mm silent FDB fan', 1, 2, 88.00, 139.99, 15, 6, 1);

-- 5. SEED INVENTORY MOVEMENTS (Historical audit log)
INSERT INTO inventory_movements (id, product_id, movement_type, quantity, previous_stock, new_stock, reason, reference_number, created_by, created_at) VALUES
(1, 1, 'STOCK_IN', 50, 0, 50, 'Initial supplier batch intake', 'PO-2026-001', 1, '2026-10-15 09:30:00'),
(2, 1, 'STOCK_OUT', 5, 50, 45, 'Order fulfillment dispatch', 'SO-8910', 2, '2026-10-18 14:15:00'),
(3, 2, 'STOCK_IN', 20, 0, 20, 'Initial supplier delivery', 'PO-2026-001', 1, '2026-10-15 09:30:00'),
(4, 2, 'STOCK_OUT', 12, 20, 8, 'Retail sales batch dispatch', 'SO-8914', 2, '2026-10-20 11:00:00'),
(5, 3, 'STOCK_IN', 30, 0, 30, 'Workstation upgrade shipment', 'PO-2026-002', 1, '2026-10-16 10:45:00'),
(6, 3, 'STOCK_OUT', 6, 30, 24, 'IT department deployment', 'REQ-1044', 2, '2026-10-22 16:30:00'),
(7, 4, 'STOCK_IN', 15, 0, 15, 'High performance drive shipment', 'PO-2026-002', 1, '2026-10-16 10:45:00'),
(8, 4, 'STOCK_OUT', 12, 15, 3, 'Enterprise client deployment', 'SO-9011', 2, '2026-10-24 13:20:00'),
(9, 7, 'STOCK_IN', 10, 0, 10, 'Audio stock intake', 'PO-2026-003', 1, '2026-10-17 11:00:00'),
(10, 7, 'STOCK_OUT', 6, 10, 4, 'Call center equipment issue', 'REQ-1050', 2, '2026-10-25 10:15:00'),
(11, 8, 'STOCK_IN', 10, 0, 10, 'Webcam delivery batch', 'PO-2026-003', 1, '2026-10-17 11:00:00'),
(12, 8, 'STOCK_OUT', 10, 10, 0, 'Bulk office setup supply', 'SO-9080', 2, '2026-10-26 15:40:00'),
(13, 9, 'STOCK_IN', 75, 0, 75, 'Accessories bulk delivery', 'PO-2026-004', 1, '2026-10-18 09:00:00'),
(14, 9, 'STOCK_OUT', 15, 75, 60, 'Office ergonomics upgrade', 'SO-9102', 2, '2026-10-26 11:20:00'),
(15, 10, 'STOCK_IN', 10, 0, 10, 'Printer intake', 'PO-2026-004', 1, '2026-10-18 09:00:00'),
(16, 10, 'STOCK_OUT', 8, 10, 2, 'Warehouse dispatch labeling setup', 'REQ-1088', 2, '2026-10-26 14:00:00');

-- 6. SEED PURCHASE ORDERS
INSERT INTO purchase_orders (id, po_number, supplier_id, order_date, expected_delivery_date, status, total_amount, notes, created_by, received_at) VALUES
(1, 'PO-2026-001', 1, '2026-10-14', '2026-10-17', 'RECEIVED', 4100.00, 'Initial peripherals stocking', 1, '2026-10-15 09:30:00'),
(2, 'PO-2026-002', 2, '2026-10-15', '2026-10-19', 'RECEIVED', 4140.00, 'Crucial RAM & NVMe SSD batch', 1, '2026-10-16 10:45:00'),
(3, 'PO-2026-003', 5, '2026-10-26', '2026-11-02', 'ORDERED', 1490.00, 'Urgent replenishment for low audio & video stock', 1, NULL),
(4, 'PO-2026-004', 3, '2026-10-27', '2026-11-04', 'DRAFT', 1600.00, 'Pending budget approval for thermal printers', 1, NULL);

-- 7. SEED PURCHASE ORDER ITEMS
INSERT INTO purchase_order_items (id, purchase_order_id, product_id, quantity_ordered, unit_cost, total_price) VALUES
(1, 1, 1, 50, 65.00, 3250.00),
(2, 1, 2, 20, 42.50, 850.00),
(3, 2, 3, 30, 78.00, 2340.00),
(4, 2, 4, 15, 120.00, 1800.00),
(5, 3, 7, 10, 54.00, 540.00),
(6, 3, 8, 10, 95.00, 950.00),
(7, 4, 10, 20, 80.00, 1600.00);

-- 8. SEED AUDIT LOGS
INSERT INTO audit_logs (id, user_id, action, entity, entity_id, details, ip_address) VALUES
(1, 1, 'SYSTEM_INIT', 'SYSTEM', 1, 'Database initialized with base tables and seed records', '127.0.0.1'),
(2, 1, 'PO_RECEIVE', 'PURCHASE_ORDER', 1, 'Received PO-2026-001 into inventory (70 units total)', '127.0.0.1'),
(3, 1, 'PO_RECEIVE', 'PURCHASE_ORDER', 2, 'Received PO-2026-002 into inventory (45 units total)', '127.0.0.1');
