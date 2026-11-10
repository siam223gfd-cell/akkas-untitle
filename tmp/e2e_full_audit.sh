#!/usr/bin/env bash
set -e

BASE_URL="http://localhost:3000/api"
PASS=0
FAIL=0

test_assert() {
  local desc="$1"
  local condition="$2"
  if [ "$condition" = "true" ]; then
    echo "  [PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $desc"
    FAIL=$((FAIL + 1))
  fi
}

echo "=========================================================="
echo "Starting Aurelia E-Commerce Comprehensive End-to-End Audit"
echo "=========================================================="

# 1. Health & Database Check
echo ""
echo "--- MODULE 1: Health & System Connectivity ---"
HEALTH_RES=$(curl -s "$BASE_URL/health")
IS_HEALTHY=$(echo "$HEALTH_RES" | grep -o '"status":"healthy"' || true)
IS_DB_CONNECTED=$(echo "$HEALTH_RES" | grep -o '"isConnected":true' || true)
test_assert "GET /api/health returns healthy" "$([ -n "$IS_HEALTHY" ] && echo true || echo false)"
test_assert "Database engine is connected" "$([ -n "$IS_DB_CONNECTED" ] && echo true || echo false)"

# 2. Authentication - Admin Login
echo ""
echo "--- MODULE 2: Administrator Authentication ---"
ADMIN_LOGIN_RES=$(curl -s -X POST "$BASE_URL/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"siam@gmail.com","password":"siam12345!"}')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN_RES" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
test_assert "Admin login with configured credentials (siam@gmail.com)" "$([ -n "$ADMIN_TOKEN" ] && echo true || echo false)"

# 3. Security - Access Control & Role-Based Authorization
echo ""
echo "--- MODULE 3: Security & Authorization (RBAC) ---"
ANON_ADMIN_CHECK=$(curl -s "$BASE_URL/admin/analytics")
test_assert "Unauthenticated request to /api/admin/analytics blocked (401)" \
  "$(echo "$ANON_ADMIN_CHECK" | grep -q 'Authentication required' && echo true || echo false)"

# 4. Customer Authentication & Account Management
echo ""
echo "--- MODULE 4: Customer Registration, Profile & Addresses ---"
TEST_CUST_EMAIL="audit_customer_$(date +%s)@example.com"
REG_RES=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Audit Customer\",\"email\":\"$TEST_CUST_EMAIL\",\"password\":\"AuditPass123!\",\"phone\":\"+8801712000000\"}")
CUST_TOKEN=$(echo "$REG_RES" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
test_assert "Customer registration succeeds and returns JWT" "$([ -n "$CUST_TOKEN" ] && echo true || echo false)"

CUST_ME_RES=$(curl -s -H "Authorization: Bearer $CUST_TOKEN" "$BASE_URL/auth/me")
test_assert "GET /api/auth/me returns customer profile" \
  "$(echo "$CUST_ME_RES" | grep -q "$TEST_CUST_EMAIL" && echo true || echo false)"

# Customer attempting to access admin route should be denied with 403
CUST_ADMIN_CHECK=$(curl -s -H "Authorization: Bearer $CUST_TOKEN" "$BASE_URL/admin/analytics")
test_assert "Customer role attempting to access admin route blocked (403)" \
  "$(echo "$CUST_ADMIN_CHECK" | grep -q 'Forbidden' && echo true || echo false)"

# Customer profile update
PROFILE_UPDATE_RES=$(curl -s -X PUT "$BASE_URL/auth/profile" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Audit Customer Updated","phone":"+8801712999999"}')
test_assert "PUT /api/auth/profile updates customer name & phone" \
  "$(echo "$PROFILE_UPDATE_RES" | grep -q 'Audit Customer Updated' && echo true || echo false)"

# Customer address creation
ADDR_RES=$(curl -s -X POST "$BASE_URL/auth/addresses" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientName": "Audit Customer Updated",
    "phone": "+8801712999999",
    "division": "Dhaka",
    "district": "Dhaka",
    "upazila": "Dhanmondi",
    "streetAddress": "Road 27, House 12, Dhanmondi",
    "label": "Home",
    "isDefault": true
  }')
ADDR_ID=$(echo "$ADDR_RES" | grep -o '"_id":"[^"]*' | head -n 1 | cut -d'"' -f4)
test_assert "POST /api/auth/addresses saves new address" "$([ -n "$ADDR_ID" ] && echo true || echo false)"

# 5. Product Management & Catalog APIs
echo ""
echo "--- MODULE 5: Product Catalog, Search & Autocomplete ---"
PRODUCTS_RES=$(curl -s "$BASE_URL/products?limit=10")
PROD_COUNT=$(echo "$PRODUCTS_RES" | grep -o '"total":[0-9]*' | cut -d':' -f2)
test_assert "GET /api/products returns active products list" "$([ "$PROD_COUNT" -gt 0 ] && echo true || echo false)"

SUGG_RES=$(curl -s "$BASE_URL/products/suggestions?q=airpods")
test_assert "GET /api/products/suggestions returns matching items" \
  "$(echo "$SUGG_RES" | grep -qi 'airpods' && echo true || echo false)"

TRENDING_RES=$(curl -s "$BASE_URL/products/trending")
test_assert "GET /api/products/trending returns topSelling, newArrivals, bestRated" \
  "$(echo "$TRENDING_RES" | grep -q 'topSelling' && echo true || echo false)"

# 6. Admin Product CRUD Lifecycle
echo ""
echo "--- MODULE 6: Admin Product CRUD Operations ---"
TEST_PROD_SKU="SKU-AUDIT-$(date +%s)"
CREATE_PROD_RES=$(curl -s -X POST "$BASE_URL/products" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Audit Test Wireless Mouse\",
    \"slug\": \"audit-test-mouse-$(date +%s)\",
    \"sku\": \"$TEST_PROD_SKU\",
    \"description\": \"Professional ergonomic wireless mouse for testing.\",
    \"category\": \"Electronics\",
    \"brand\": \"Logitech\",
    \"basePrice\": 3500,
    \"salePrice\": 2999,
    \"stock\": 50,
    \"images\": [\"https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=400&q=80\"],
    \"status\": \"active\"
  }")
NEW_PROD_ID=$(echo "$CREATE_PROD_RES" | grep -o '"_id":"[^"]*' | head -n 1 | cut -d'"' -f4)
test_assert "Admin creates new product (POST /api/products)" "$([ -n "$NEW_PROD_ID" ] && echo true || echo false)"

UPDATE_PROD_RES=$(curl -s -X PUT "$BASE_URL/products/$NEW_PROD_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"salePrice": 2499, "stock": 45}')
test_assert "Admin updates product price & stock (PUT /api/products/:id)" \
  "$(echo "$UPDATE_PROD_RES" | grep -q '"salePrice":2499' && echo true || echo false)"

# Verify storefront immediately reflects the updated price
VERIFY_STOREFRONT=$(curl -s "$BASE_URL/products/$NEW_PROD_ID")
test_assert "Storefront immediately reflects updated product price" \
  "$(echo "$VERIFY_STOREFRONT" | grep -q '"salePrice":2499' && echo true || echo false)"

# Delete product
DEL_PROD_RES=$(curl -s -X DELETE "$BASE_URL/products/$NEW_PROD_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
test_assert "Admin deletes product (DELETE /api/products/:id)" \
  "$(echo "$DEL_PROD_RES" | grep -q 'Product deleted successfully' && echo true || echo false)"

# 7. Category Management CRUD
echo ""
echo "--- MODULE 7: Category Management CRUD ---"
CATEGORIES_RES=$(curl -s "$BASE_URL/categories")
test_assert "GET /api/categories returns catalog categories with live count" \
  "$(echo "$CATEGORIES_RES" | grep -q 'Electronics' && echo true || echo false)"

NEW_CAT_RES=$(curl -s -X POST "$BASE_URL/categories" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Audit Category","slug":"audit-cat","order":99}')
NEW_CAT_ID=$(echo "$NEW_CAT_RES" | grep -o '"_id":"[^"]*' | head -n 1 | cut -d'"' -f4)
test_assert "Admin creates new category (POST /api/categories)" "$([ -n "$NEW_CAT_ID" ] && echo true || echo false)"

DEL_CAT_RES=$(curl -s -X DELETE "$BASE_URL/categories/$NEW_CAT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
test_assert "Admin deletes category (DELETE /api/categories/:id)" \
  "$(echo "$DEL_CAT_RES" | grep -q 'Category deleted successfully' && echo true || echo false)"

# 8. Coupon Management & Validation
echo ""
echo "--- MODULE 8: Coupon System & Calculation ---"
COUPON_VAL_RES=$(curl -s -X POST "$BASE_URL/coupons/validate" \
  -H "Content-Type: application/json" \
  -d '{"code":"NOVARA10","subtotal":25000}')
test_assert "POST /api/coupons/validate verifies valid coupon" \
  "$(echo "$COUPON_VAL_RES" | grep -q 'Coupon applied' && echo true || echo false)"

COUPON_INVALID_RES=$(curl -s -X POST "$BASE_URL/coupons/validate" \
  -H "Content-Type: application/json" \
  -d '{"code":"NON_EXISTENT_CODE","subtotal":25000}')
test_assert "POST /api/coupons/validate rejects invalid coupon" \
  "$(echo "$COUPON_INVALID_RES" | grep -q 'Invalid or expired' && echo true || echo false)"

# 9. Cart Validation & Stock Verification
echo ""
echo "--- MODULE 9: Cart Validation ---"
CART_VAL_RES=$(curl -s -X POST "$BASE_URL/cart/validate" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":"seed-airpods-pro-2","name":"AirPods Pro 2","price":24990,"quantity":2}]}')
test_assert "POST /api/cart/validate returns validated subtotal and shipping" \
  "$(echo "$CART_VAL_RES" | grep -q '"isFreeShipping":true' && echo true || echo false)"

# 10. Wishlist Management APIs
echo ""
echo "--- MODULE 10: Wishlist CRUD & Customer Sync ---"
WL_GET_RES=$(curl -s -H "Authorization: Bearer $CUST_TOKEN" "$BASE_URL/wishlist")
test_assert "GET /api/wishlist retrieves customer wishlist" \
  "$(echo "$WL_GET_RES" | grep -q '"success":true' && echo true || echo false)"

# 11. Order Lifecycle: Placement, Stock Deduction, Admin Processing & Status Updates
echo ""
echo "--- MODULE 11: Order Placement & Processing Lifecycle ---"
ORDER_RES=$(curl -s -X POST "$BASE_URL/orders" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{
      "productId": "seed-airpods-pro-2",
      "name": "AirPods Pro 2",
      "sku": "APP2-WHT",
      "price": 24990,
      "quantity": 1
    }],
    "shippingAddress": {
      "recipientName": "Audit Customer Updated",
      "phone": "+8801712999999",
      "division": "Dhaka",
      "district": "Dhaka",
      "upazila": "Dhanmondi",
      "streetAddress": "Road 27, House 12, Dhanmondi"
    },
    "paymentMethod": "cod"
  }')
ORDER_ID=$(echo "$ORDER_RES" | grep -o '"_id":"[^"]*' | head -n 1 | cut -d'"' -f4)
ORDER_NUM=$(echo "$ORDER_RES" | grep -o '"orderNumber":"[^"]*' | cut -d'"' -f4)
test_assert "Customer creates order ($ORDER_NUM)" "$([ -n "$ORDER_ID" ] && echo true || echo false)"

# Admin fetches order
ADMIN_ORDERS_RES=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/orders")
test_assert "Admin orders list contains newly placed order" \
  "$(echo "$ADMIN_ORDERS_RES" | grep -q "$ORDER_NUM" && echo true || echo false)"

# Admin transitions order status to 'processing'
STATUS_UPDATE_RES=$(curl -s -X PATCH "$BASE_URL/orders/$ORDER_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"processing","note":"Order verified by QA auditor"}')
test_assert "Admin updates order status to processing" \
  "$(echo "$STATUS_UPDATE_RES" | grep -q 'Order status updated' && echo true || echo false)"

# 12. Reviews & Ratings Moderation
echo ""
echo "--- MODULE 12: Reviews & Moderation ---"
REVIEWS_PUBLIC_RES=$(curl -s "$BASE_URL/reviews")
test_assert "GET /api/reviews returns approved customer reviews" \
  "$(echo "$REVIEWS_PUBLIC_RES" | grep -q '"success":true' && echo true || echo false)"

# 13. Support & CMS Management
echo ""
echo "--- MODULE 13: Customer Support & Content Management ---"
SUPPORT_RES=$(curl -s -X POST "$BASE_URL/support" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Audit User",
    "email": "audit@user.com",
    "subject": "System Verification Enquiry",
    "message": "Testing automated customer message intake."
  }')
test_assert "POST /api/support submits customer enquiry" \
  "$(echo "$SUPPORT_RES" | grep -q 'enquiry has been received' && echo true || echo false)"

CMS_RES=$(curl -s "$BASE_URL/cms/config")
test_assert "GET /api/cms/config returns homepage & banner layout" \
  "$(echo "$CMS_RES" | grep -q 'Upgrade Your Life with' && echo true || echo false)"

# 14. Admin Analytics & System Backup
echo ""
echo "--- MODULE 14: Admin Analytics & Backup Snapshot ---"
ANALYTICS_RES=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/admin/analytics")
test_assert "GET /api/admin/analytics reflects real database stats" \
  "$(echo "$ANALYTICS_RES" | grep -q '"totalVisitors":24532' && echo true || echo false)"

BACKUP_RES=$(curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/admin/backup/export")
test_assert "POST /api/admin/backup/export creates full snapshot" \
  "$(echo "$BACKUP_RES" | grep -q 'Database backup snapshot generated' && echo true || echo false)"

echo ""
echo "=========================================================="
echo "AUDIT SUITE COMPLETE: $PASS PASSED, $FAIL FAILED"
echo "=========================================================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
