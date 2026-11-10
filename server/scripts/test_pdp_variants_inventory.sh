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
echo "Starting Deep PDP, Variants & Atomic Inventory Verification"
echo "=========================================================="

# 1. Admin Authentication
ADMIN_LOGIN_RES=$(curl -s -X POST "$BASE_URL/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"siam@gmail.com","password":"siam12345!"}')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN_RES" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
test_assert "Admin login successful" "$([ -n "$ADMIN_TOKEN" ] && echo true || echo false)"

# 2. Get Samsung Galaxy S25 Ultra 5G details
PDP_RES=$(curl -s "$BASE_URL/products/samsung-galaxy-s25-ultra")
PROD_ID=$(echo "$PDP_RES" | grep -o '"_id":"[^"]*' | head -n 1 | cut -d'"' -f4)
INITIAL_TOTAL_STOCK=$(node -e 'try{console.log(JSON.parse(process.argv[1]).product.stock)}catch(e){}' "$PDP_RES")
# Check variant stock for SKU SG-S25U-001-BLU-512
TARGET_SKU="SG-S25U-001-BLU-512"
INITIAL_VAR_STOCK=$(node -e '
  try {
    const p = JSON.parse(process.argv[1]).product;
    const v = p.variants.find(item => item.sku === "'"$TARGET_SKU"'");
    console.log(v ? v.stock : 0);
  } catch(e) { console.log(0); }
' "$PDP_RES")

test_assert "Flagship PDP loaded by slug (ID: $PROD_ID)" "$([ -n "$PROD_ID" ] && echo true || echo false)"
test_assert "Initial variant ($TARGET_SKU) stock is $INITIAL_VAR_STOCK" "$([ "$INITIAL_VAR_STOCK" -gt 0 ] && echo true || echo false)"

# 3. Create a Customer and place an order for this variant
CUST_EMAIL="var_test_$(date +%s)@example.com"
REG_RES=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Variant Tester\",\"email\":\"$CUST_EMAIL\",\"password\":\"Pass1234!\"}")
CUST_TOKEN=$(echo "$REG_RES" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

ORDER_PAYLOAD=$(cat <<EOF
{
  "items": [{
    "productId": "$PROD_ID",
    "name": "Samsung Galaxy S25 Ultra 5G (Titanium Blue / 512GB)",
    "sku": "$TARGET_SKU",
    "price": 144999,
    "quantity": 2,
    "variant": {
      "Color": "Titanium Blue",
      "Storage": "512GB"
    }
  }],
  "shippingAddress": {
    "recipientName": "Variant Tester",
    "phone": "+8801700112233",
    "division": "Dhaka",
    "district": "Dhaka",
    "upazila": "Gulshan",
    "streetAddress": "Road 11, Block D"
  },
  "paymentMethod": "cod"
}
EOF
)

ORDER_RES=$(curl -s -X POST "$BASE_URL/orders" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$ORDER_PAYLOAD")

ORDER_ID=$(node -e 'try{console.log(JSON.parse(process.argv[1]).order._id)}catch(e){}' "$ORDER_RES")
test_assert "Order placed with specific variant snapshot (Order ID: $ORDER_ID)" "$([ -n "$ORDER_ID" ] && echo true || echo false)"

# 4. Check stock after order placement
AFTER_ORDER_RES=$(curl -s "$BASE_URL/products/$PROD_ID")
AFTER_TOTAL_STOCK=$(node -e 'try{console.log(JSON.parse(process.argv[1]).product.stock)}catch(e){}' "$AFTER_ORDER_RES")
AFTER_VAR_STOCK=$(node -e '
  try {
    const p = JSON.parse(process.argv[1]).product;
    const v = p.variants.find(item => item.sku === "'"$TARGET_SKU"'");
    console.log(v ? v.stock : 0);
  } catch(e) { console.log(0); }
' "$AFTER_ORDER_RES")

EXPECTED_TOTAL_STOCK=$((INITIAL_TOTAL_STOCK - 2))
EXPECTED_VAR_STOCK=$((INITIAL_VAR_STOCK - 2))

test_assert "Parent stock decremented atomically ($INITIAL_TOTAL_STOCK -> $AFTER_TOTAL_STOCK)" "$([ "$AFTER_TOTAL_STOCK" -eq "$EXPECTED_TOTAL_STOCK" ] && echo true || echo false)"
test_assert "Variant stock decremented atomically ($INITIAL_VAR_STOCK -> $AFTER_VAR_STOCK)" "$([ "$AFTER_VAR_STOCK" -eq "$EXPECTED_VAR_STOCK" ] && echo true || echo false)"

# 5. Cancel order and verify stock restoration
CANCEL_RES=$(curl -s -X POST "$BASE_URL/orders/$ORDER_ID/cancel" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Customer changed mind during automated test"}')

test_assert "Order cancelled successfully" "$(echo "$CANCEL_RES" | grep -qi 'cancelled' && echo true || echo false)"

AFTER_CANCEL_RES=$(curl -s "$BASE_URL/products/$PROD_ID")
RESTORED_TOTAL_STOCK=$(node -e 'try{console.log(JSON.parse(process.argv[1]).product.stock)}catch(e){}' "$AFTER_CANCEL_RES")
RESTORED_VAR_STOCK=$(node -e '
  try {
    const p = JSON.parse(process.argv[1]).product;
    const v = p.variants.find(item => item.sku === "'"$TARGET_SKU"'");
    console.log(v ? v.stock : 0);
  } catch(e) { console.log(0); }
' "$AFTER_CANCEL_RES")

test_assert "Parent stock restored upon cancellation ($AFTER_TOTAL_STOCK -> $RESTORED_TOTAL_STOCK)" "$([ "$RESTORED_TOTAL_STOCK" -eq "$INITIAL_TOTAL_STOCK" ] && echo true || echo false)"
test_assert "Variant stock restored upon cancellation ($AFTER_VAR_STOCK -> $RESTORED_VAR_STOCK)" "$([ "$RESTORED_VAR_STOCK" -eq "$INITIAL_VAR_STOCK" ] && echo true || echo false)"

# 6. Admin Product Duplication Test
DUP_RES=$(curl -s -X POST "$BASE_URL/products/$PROD_ID/duplicate" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
DUP_ID=$(node -e 'try{console.log(JSON.parse(process.argv[1]).product._id)}catch(e){}' "$DUP_RES")
DUP_NAME=$(node -e 'try{console.log(JSON.parse(process.argv[1]).product.name)}catch(e){}' "$DUP_RES")

test_assert "Admin duplicates product successfully ($DUP_NAME, ID: $DUP_ID)" "$([ -n "$DUP_ID" ] && echo true || echo false)"

# Clean up duplicated product
DEL_DUP_RES=$(curl -s -X DELETE "$BASE_URL/products/$DUP_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
test_assert "Admin cleans up duplicated test product" "$(echo "$DEL_DUP_RES" | grep -q 'Product deleted' && echo true || echo false)"

# 7. Customer Review submission and helpful vote
REV_SUBMIT_RES=$(curl -s -X POST "$BASE_URL/reviews" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"productId\": \"$PROD_ID\",
    \"rating\": 5,
    \"title\": \"Absolute Masterpiece!\",
    \"comment\": \"The 200MP camera and display are truly remarkable.\",
    \"photos\": [\"https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=600&q=80\"]
  }")
NEW_REV_ID=$(node -e 'try{console.log(JSON.parse(process.argv[1]).review._id)}catch(e){}' "$REV_SUBMIT_RES")
test_assert "Customer submits 5-star review with photo (Review ID: $NEW_REV_ID)" "$([ -n "$NEW_REV_ID" ] && echo true || echo false)"

# Upvote the newly submitted review
UPVOTE_RES=$(curl -s -X POST "$BASE_URL/reviews/$NEW_REV_ID/helpful")
HELPFUL_COUNT=$(node -e 'try{console.log(JSON.parse(process.argv[1]).helpfulCount)}catch(e){}' "$UPVOTE_RES")
test_assert "Review helpful count incremented to $HELPFUL_COUNT" "$([ "$HELPFUL_COUNT" -eq 1 ] && echo true || echo false)"

echo ""
echo "=========================================================="
echo "PDP & INVENTORY VERIFICATION: $PASS PASSED, $FAIL FAILED"
echo "=========================================================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
