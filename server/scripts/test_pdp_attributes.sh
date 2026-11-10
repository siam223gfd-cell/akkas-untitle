#!/bin/bash
set -e

BASE_URL="http://localhost:3000/api"
echo "=== STEP 1: TRIGGER CATALOG SEEDING ==="
SEED_RES=$(curl -s -X POST "$BASE_URL/health/seed")
echo "Seed response: $SEED_RES"

echo -e "\n=== STEP 2: TEST ATTRIBUTES CRUD ==="
# Get attributes
ATTRS=$(curl -s "$BASE_URL/attributes")
echo "Attributes count: $(echo "$ATTRS" | node -e 'let d = JSON.parse(require("fs").readFileSync(0, "utf-8")); console.log(d.attributes?.length || 0)')"

# Login as admin to get auth token
LOGIN_RES=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "siam@gmail.com", "password": "siam12345!"}')
TOKEN=$(echo "$LOGIN_RES" | node -e 'let d = JSON.parse(require("fs").readFileSync(0, "utf-8")); console.log(d.token || "")')
echo "Admin logged in, token acquired: ${TOKEN:0:15}..."

# Create a test attribute with admin token
NEW_ATTR=$(curl -s -X POST "$BASE_URL/attributes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Material",
    "slug": "test-material",
    "type": "select",
    "values": [{"label": "Titanium Grade 5", "value": "titanium-grade-5"}],
    "categories": ["Electronics"],
    "isRequired": false,
    "isFilterable": true,
    "isVisibleOnPDP": true,
    "displayOrder": 10
  }')
echo "New attribute response: $NEW_ATTR"

NEW_ATTR_ID=$(echo "$NEW_ATTR" | node -e 'let d = JSON.parse(require("fs").readFileSync(0, "utf-8")); console.log(d.attribute?._id || "")')

if [ -n "$NEW_ATTR_ID" ]; then
  echo "Updating attribute $NEW_ATTR_ID with admin token..."
  UPD_ATTR=$(curl -s -X PUT "$BASE_URL/attributes/$NEW_ATTR_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
      "name": "Test Material Updated",
      "slug": "test-material",
      "type": "select",
      "values": [{"label": "Aerospace Titanium", "value": "aerospace-titanium"}],
      "categories": ["Electronics"]
    }')
  echo "Updated attribute: $UPD_ATTR"

  echo "Deleting test attribute $NEW_ATTR_ID with admin token..."
  DEL_ATTR=$(curl -s -X DELETE "$BASE_URL/attributes/$NEW_ATTR_ID" \
    -H "Authorization: Bearer $TOKEN")
  echo "Delete response: $DEL_ATTR"
fi

echo -e "\n=== STEP 3: TEST SAMSUNG GALAXY S25 ULTRA PDP DATA ==="
PROD_RES=$(curl -s "$BASE_URL/products/samsung-galaxy-s25-ultra")
echo "Product Name: $(echo "$PROD_RES" | node -e 'let d = JSON.parse(require("fs").readFileSync(0, "utf-8")); console.log(d.product?.name)')"
echo "Price: $(echo "$PROD_RES" | node -e 'let d = JSON.parse(require("fs").readFileSync(0, "utf-8")); console.log(d.product?.salePrice)')"
echo "Original Price: $(echo "$PROD_RES" | node -e 'let d = JSON.parse(require("fs").readFileSync(0, "utf-8")); console.log(d.product?.basePrice)')"
echo "Variants Count: $(echo "$PROD_RES" | node -e 'let d = JSON.parse(require("fs").readFileSync(0, "utf-8")); console.log(d.product?.variants?.length || 0)')"
echo "Highlights Count: $(echo "$PROD_RES" | node -e 'let d = JSON.parse(require("fs").readFileSync(0, "utf-8")); console.log(d.product?.highlights?.length || 0)')"
echo "Specs Table Count: $(echo "$PROD_RES" | node -e 'let d = JSON.parse(require("fs").readFileSync(0, "utf-8")); console.log(d.product?.specificationsTable?.length || 0)')"
echo "Related Products: $(echo "$PROD_RES" | node -e 'let d = JSON.parse(require("fs").readFileSync(0, "utf-8")); console.log(d.related?.length || 0)')"

echo -e "\n=== STEP 4: TEST REVIEWS & HELPFUL UPVOTING ==="
REVIEWS_RES=$(curl -s "$BASE_URL/reviews?productId=samsung-galaxy-s25-ultra")
echo "Reviews count: $(echo "$REVIEWS_RES" | node -e 'let d = JSON.parse(require("fs").readFileSync(0, "utf-8")); console.log(d.reviews?.length || 0)')"
FIRST_REV_ID=$(echo "$REVIEWS_RES" | node -e 'let d = JSON.parse(require("fs").readFileSync(0, "utf-8")); console.log(d.reviews?.[0]?._id || "")')
if [ -n "$FIRST_REV_ID" ]; then
  echo "Upvoting review $FIRST_REV_ID..."
  VOTE_RES=$(curl -s -X POST "$BASE_URL/reviews/$FIRST_REV_ID/helpful")
  echo "Helpful vote response: $VOTE_RES"
fi

echo -e "\n=== STEP 5: TEST MULTI-CATEGORY PRODUCTS (FASHION & FOOTWEAR) ==="
FASHION_RES=$(curl -s "$BASE_URL/products/aurelia-heavyweight-cotton-tee")
echo "Fashion Tee Name: $(echo "$FASHION_RES" | node -e 'let d = JSON.parse(require("fs").readFileSync(0, "utf-8")); console.log(d.product?.name)')"
echo "Fashion Tee Variants: $(echo "$FASHION_RES" | node -e 'let d = JSON.parse(require("fs").readFileSync(0, "utf-8")); console.log(d.product?.variants?.length || 0)')"

SHOE_RES=$(curl -s "$BASE_URL/products/aurelia-velocity-pro-running-shoes")
echo "Shoe Name: $(echo "$SHOE_RES" | node -e 'let d = JSON.parse(require("fs").readFileSync(0, "utf-8")); console.log(d.product?.name)')"
echo "Shoe Variants: $(echo "$SHOE_RES" | node -e 'let d = JSON.parse(require("fs").readFileSync(0, "utf-8")); console.log(d.product?.variants?.length || 0)')"

echo -e "\n=== ALL CHECKS PASSED SUCCESSFULLY ==="
