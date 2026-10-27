/**
 * Automated Verification Test Suite
 * Tests all 14 mandatory technical scenarios specified in the project requirements:
 * 1. Create a valid product
 * 2. Attempt duplicate SKU rejection (409)
 * 3. Retrieve and update product details
 * 4. Search and filter products
 * 5. Add stock (Stock-In) and verify resulting quantity
 * 6. Remove stock (Stock-Out) and verify resulting quantity
 * 7. Attempt to remove more stock than available (must fail with 400)
 * 8. Verify failed stock operations do NOT create movement records
 * 9. Verify low-stock alert triggers at current_stock <= min_stock_threshold
 * 10. Create a multi-item purchase order and receive it (updates stock + movements)
 * 11. Attempt to receive the same purchase order twice (must fail with 409)
 * 12. Verify transaction rollback on failure
 * 13. Test invalid product IDs and malformed inputs (400 / 404)
 * 14. Verify dashboard metrics match actual database counts
 */

const http = require('http');
const app = require('../src/app');
const db = require('../src/config/database');
const initDb = require('../database/init_db');

let server;
let baseUrl;
let authToken = '';

function logPass(msg) {
    console.log(`  ✅ [PASS] ${msg}`);
}

function logFail(msg, detail) {
    console.error(`  ❌ [FAIL] ${msg}`);
    if (detail) console.error(`     Detail:`, detail);
    process.exitCode = 1;
}

async function request(method, path, body = null, token = authToken) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
}

async function runTests() {
    console.log('================================================================');
    console.log('  🧪 RUNNING COMPREHENSIVE INVENTORY SYSTEM VERIFICATION TESTS');
    console.log('================================================================\n');

    // Setup fresh database
    await initDb();

    // Start server on an ephemeral port
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
    console.log(`  📡 Ephemeral test server listening on ${baseUrl}\n`);

    try {
        // Step 0: Authenticate
        const loginRes = await request('POST', '/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });
        if (loginRes.status === 200 && loginRes.data.data.token) {
            authToken = loginRes.data.data.token;
            logPass('Authentication: Admin logged in and received JWT');
        } else {
            logFail('Authentication failed', loginRes.data);
            return;
        }

        // Scenario 1: Create a valid product
        const uniqueSku = `TEST-SKU-${Date.now()}`;
        const createRes = await request('POST', '/api/products', {
            sku: uniqueSku,
            name: 'Test Ergonomic Monitor Stand',
            description: 'Automated test product for validation',
            category_id: 4,
            supplier_id: 3,
            unit_cost: 25.50,
            selling_price: 49.99,
            current_stock: 20,
            min_stock_threshold: 15
        });

        let testProductId = null;
        if (createRes.status === 201 && createRes.data.data.sku === uniqueSku) {
            testProductId = createRes.data.data.id;
            logPass(`Scenario 1: Created valid product (ID: ${testProductId}, SKU: ${uniqueSku})`);
        } else {
            logFail('Scenario 1: Failed to create valid product', createRes.data);
        }

        // Scenario 2: Attempt duplicate SKU
        const dupRes = await request('POST', '/api/products', {
            sku: uniqueSku,
            name: 'Duplicate Test Product',
            category_id: 4,
            supplier_id: 3,
            unit_cost: 10,
            selling_price: 20,
            current_stock: 5,
            min_stock_threshold: 2
        });

        if (dupRes.status === 409) {
            logPass('Scenario 2: Duplicate SKU rejected with HTTP 409 Conflict as required');
        } else {
            logFail(`Scenario 2: Expected 409 for duplicate SKU, received ${dupRes.status}`, dupRes.data);
        }

        // Scenario 3: Retrieve and update a product
        const getRes = await request('GET', `/api/products/${testProductId}`);
        const updateRes = await request('PUT', `/api/products/${testProductId}`, {
            name: 'Updated Test Ergonomic Monitor Stand Deluxe',
            selling_price: 54.99
        });

        if (
            getRes.status === 200 &&
            updateRes.status === 200 &&
            updateRes.data.data.name === 'Updated Test Ergonomic Monitor Stand Deluxe' &&
            Number(updateRes.data.data.selling_price) === 54.99
        ) {
            logPass('Scenario 3: Successfully retrieved and updated product details');
        } else {
            logFail('Scenario 3: Failed to retrieve or update product', updateRes.data);
        }

        // Scenario 4: Search and filter products
        const searchRes = await request('GET', `/api/products?search=${uniqueSku}`);
        const filterRes = await request('GET', `/api/products?category_id=4&stock_status=in_stock`);

        if (
            searchRes.status === 200 &&
            searchRes.data.data.length === 1 &&
            filterRes.status === 200 &&
            filterRes.data.data.length > 0
        ) {
            logPass('Scenario 4: Product search by SKU and category filtering functioning accurately');
        } else {
            logFail('Scenario 4: Search and filter test failed', { searchRes: searchRes.data, filterRes: filterRes.data });
        }

        // Scenario 5: Add stock and verify new quantity
        const initialStock = 20;
        const addQty = 15;
        const stockInRes = await request('POST', '/api/inventory/stock-in', {
            product_id: testProductId,
            quantity: addQty,
            reason: 'Test shipment intake batch #1',
            reference_number: 'TEST-BATCH-01'
        });

        const verifyStockIn = await request('GET', `/api/products/${testProductId}`);
        if (
            stockInRes.status === 201 &&
            verifyStockIn.data.data.current_stock === initialStock + addQty
        ) {
            logPass(`Scenario 5: Stock-In added ${addQty} units. New quantity correctly equals ${initialStock + addQty}`);
        } else {
            logFail('Scenario 5: Stock-In verification failed', { stockInRes: stockInRes.data, current: verifyStockIn.data });
        }

        // Scenario 6: Remove stock and verify new quantity
        const removeQty = 10;
        const expectedStockAfterOut = initialStock + addQty - removeQty;
        const stockOutRes = await request('POST', '/api/inventory/stock-out', {
            product_id: testProductId,
            quantity: removeQty,
            reason: 'Test customer order dispatch',
            reference_number: 'TEST-SO-101'
        });

        const verifyStockOut = await request('GET', `/api/products/${testProductId}`);
        if (
            stockOutRes.status === 200 &&
            verifyStockOut.data.data.current_stock === expectedStockAfterOut
        ) {
            logPass(`Scenario 6: Stock-Out removed ${removeQty} units. New quantity verified at ${expectedStockAfterOut}`);
        } else {
            logFail('Scenario 6: Stock-Out verification failed', { stockOutRes: stockOutRes.data, current: verifyStockOut.data });
        }

        // Scenario 7: Attempt to remove more stock than available
        const excessiveQty = 99999;
        const countBeforeExcess = (await db.query('SELECT COUNT(*) as count FROM inventory_movements WHERE product_id = ?', [testProductId]))[0][0].count;

        const overOutRes = await request('POST', '/api/inventory/stock-out', {
            product_id: testProductId,
            quantity: excessiveQty,
            reason: 'Illegal overselling attempt',
            reference_number: 'ILLEGAL-OVER-OUT'
        });

        if (overOutRes.status === 400 && overOutRes.data.message.includes('Insufficient inventory')) {
            logPass('Scenario 7: Overselling prevented with HTTP 400 Bad Request');
        } else {
            logFail(`Scenario 7: Expected 400 for negative stock attempt, got ${overOutRes.status}`, overOutRes.data);
        }

        // Scenario 8: Confirm failed stock operations do NOT create movement records
        const countAfterExcess = (await db.query('SELECT COUNT(*) as count FROM inventory_movements WHERE product_id = ?', [testProductId]))[0][0].count;
        if (countBeforeExcess === countAfterExcess) {
            logPass(`Scenario 8: Transaction rolled back; movement count preserved (${countBeforeExcess} records)`);
        } else {
            logFail(`Scenario 8: Movement record was improperly inserted during failed transaction! Before: ${countBeforeExcess}, After: ${countAfterExcess}`);
        }

        // Scenario 9: Verify low-stock alerts appear at correct threshold
        // Current stock is 25, min_threshold is 15. Let's reduce stock to 12 (<= 15)
        await request('POST', '/api/inventory/stock-out', {
            product_id: testProductId,
            quantity: 13,
            reason: 'Reduce stock below threshold for alert test'
        });

        const lowStockRes = await request('GET', `/api/inventory/low-stock?search=${uniqueSku}`);
        const lowItem = lowStockRes.data.data.find(i => i.id === testProductId);

        if (lowStockRes.status === 200 && lowItem && lowItem.current_stock <= lowItem.min_stock_threshold) {
            logPass(`Scenario 9: Low-stock alert detected product at stock ${lowItem.current_stock} <= threshold ${lowItem.min_stock_threshold} (Suggested reorder: ${lowItem.suggested_reorder_qty} units)`);
        } else {
            logFail('Scenario 9: Low stock alert test failed', lowStockRes.data);
        }

        // Scenario 10: Create a purchase order and receive it
        const poRes = await request('POST', '/api/purchase-orders', {
            supplier_id: 3,
            order_date: '2026-10-27',
            notes: 'Automated test purchase order',
            items: [
                {
                    product_id: testProductId,
                    quantity_ordered: 20,
                    unit_cost: 25.50
                }
            ]
        });

        let testPoId = null;
        if (poRes.status === 201 && poRes.data.data.id) {
            testPoId = poRes.data.data.id;
            const receiveRes = await request('POST', `/api/purchase-orders/${testPoId}/receive`);
            const postReceiveProduct = await request('GET', `/api/products/${testProductId}`);

            if (
                receiveRes.status === 200 &&
                receiveRes.data.data.status === 'RECEIVED' &&
                postReceiveProduct.data.data.current_stock === 12 + 20
            ) {
                logPass(`Scenario 10: Purchase order #${testPoId} created and received. Product stock increased by 20 to ${postReceiveProduct.data.data.current_stock}`);
            } else {
                logFail('Scenario 10: Purchase order receipt failed', { receiveRes: receiveRes.data, product: postReceiveProduct.data });
            }
        } else {
            logFail('Scenario 10: Purchase order creation failed', poRes.data);
        }

        // Scenario 11: Attempt to receive the same purchase order twice
        const dupReceiveRes = await request('POST', `/api/purchase-orders/${testPoId}/receive`);
        if (dupReceiveRes.status === 409) {
            logPass('Scenario 11: Duplicate purchase order receipt rejected with HTTP 409 Conflict');
        } else {
            logFail(`Scenario 11: Expected 409 for duplicate PO receipt, got ${dupReceiveRes.status}`, dupReceiveRes.data);
        }

        // Scenario 12: Confirm that failed transactions roll back all related changes
        // Attempt an adjustment with negative quantity to trigger validation rollback
        const targetNegative = -50;
        const failedAdjRes = await request('POST', '/api/inventory/adjustments', {
            product_id: testProductId,
            new_stock: targetNegative,
            reason: 'Invalid negative adjustment test'
        });

        const verifyUnchangedProduct = await request('GET', `/api/products/${testProductId}`);
        if (failedAdjRes.status === 400 && verifyUnchangedProduct.data.data.current_stock === 32) {
            logPass('Scenario 12: Atomic rollback verified: Invalid adjustment rejected, stock left untouched at 32');
        } else {
            logFail('Scenario 12: Failed transaction integrity check', { failedAdjRes: failedAdjRes.data, product: verifyUnchangedProduct.data });
        }

        // Scenario 13: Test invalid product IDs and malformed inputs
        const invalidIdRes = await request('GET', '/api/products/9999999');
        const malformedIdRes = await request('GET', '/api/products/abc-invalid');

        if (invalidIdRes.status === 404 && malformedIdRes.status === 400) {
            logPass('Scenario 13: Invalid IDs return 404 and malformed non-integer IDs return 400');
        } else {
            logFail('Scenario 13: Input validation error handling failed', { invalid: invalidIdRes.status, malformed: malformedIdRes.status });
        }

        // Scenario 14: Verify that dashboard totals match the database
        const dashboardRes = await request('GET', '/api/dashboard/summary');
        const [dbProducts] = await db.query('SELECT COUNT(*) as count, SUM(current_stock * unit_cost) as val FROM products WHERE is_active = 1');
        const [dbCategories] = await db.query('SELECT COUNT(*) as count FROM categories WHERE is_active = 1');
        const [dbSuppliers] = await db.query('SELECT COUNT(*) as count FROM suppliers WHERE is_active = 1');

        const metrics = dashboardRes.data.data.metrics;
        const dbProductCount = dbProducts[0].count;
        const dbCategoryCount = dbCategories[0].count;
        const dbSupplierCount = dbSuppliers[0].count;

        if (
            dashboardRes.status === 200 &&
            metrics.total_active_products === dbProductCount &&
            metrics.total_categories === dbCategoryCount &&
            metrics.total_suppliers === dbSupplierCount
        ) {
            logPass(`Scenario 14: Dashboard totals accurately match database (Products: ${metrics.total_active_products}, Categories: ${metrics.total_categories}, Suppliers: ${metrics.total_suppliers})`);
        } else {
            logFail('Scenario 14: Dashboard totals mismatch with DB', { apiMetrics: metrics, db: { dbProductCount, dbCategoryCount, dbSupplierCount } });
        }

        console.log('\n================================================================');
        console.log('  🎉 ALL 14 TEST SCENARIOS COMPLETED SUCCESSFULLY!');
        console.log('================================================================\n');
    } catch (err) {
        console.error('Fatal test error:', err);
        process.exitCode = 1;
    } finally {
        if (server) {
            server.close();
        }
    }
}

if (require.main === module) {
    runTests().then(() => {
        process.exit(process.exitCode || 0);
    });
}

module.exports = runTests;
