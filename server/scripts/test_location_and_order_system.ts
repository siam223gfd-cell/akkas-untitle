import { getAllDivision, getDistricts, getUpazilas, getUnions } from 'bd-divisions-to-unions';
import { validateLocationHierarchy } from '../modules/locations/locations.routes';
import { isValidBdPhone, normalizeBdPhone, isValidBdPostalCode } from '../utils/commerce';

console.log('================================================================');
console.log('   BANGLADESH LOCATION SELECTOR & VALIDATION AUDIT SUITE        ');
console.log('================================================================\n');

let allPassed = true;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName} - Detail: ${detail}`);
    allPassed = false;
  }
}

// -------------------------------------------------------------
// Test Suite 1: Mandatory Package & Administrative Hierarchy
// -------------------------------------------------------------
console.log('--- TEST SUITE 1: bd-divisions-to-unions Hierarchy (EN & BN) ---');

const divisionsEn = getAllDivision('en');
const divisionsBn = getAllDivision();
assert(divisionsEn && divisionsEn.length === 8, 'getAllDivision("en") returns all 8 divisions', `Found ${divisionsEn?.length}`);
assert(divisionsBn && divisionsBn.length === 8, 'getAllDivision() (Bangla default) returns all 8 divisions', `Found ${divisionsBn?.length}`);

const dhakaDiv = divisionsEn.find((d) => d.title.toLowerCase() === 'dhaka');
const dhakaDivBn = divisionsBn.find((d) => String(d.value) === String(dhakaDiv?.value));
assert(!!dhakaDiv && !!dhakaDivBn, 'Dhaka division exists in both EN and BN with matching ID', `${dhakaDiv?.value}`);

const dhakaDistrictsEn = getDistricts(dhakaDiv!.value, 'en');
assert(!!dhakaDistrictsEn && dhakaDistrictsEn.length === 13, 'Dhaka division has 13 districts', `Found ${dhakaDistrictsEn?.length}`);

const dhakaDistrict = dhakaDistrictsEn!.find((d) => d.title.toLowerCase() === 'dhaka');
assert(!!dhakaDistrict, 'Dhaka district exists under Dhaka division', JSON.stringify(dhakaDistrict));

const dhakaUpazilasEn = getUpazilas(dhakaDistrict!.value, 'en');
assert(!!dhakaUpazilasEn && dhakaUpazilasEn.length >= 7, 'Dhaka district has upazilas and city corporations', `Found ${dhakaUpazilasEn?.length}`);

const savarUpazila = dhakaUpazilasEn!.find((u) => u.title.toLowerCase() === 'savar');
assert(!!savarUpazila, 'Savar upazila exists under Dhaka district', JSON.stringify(savarUpazila));

const northCityCorp = dhakaUpazilasEn!.find((u) => u.title.includes('North City'));
assert(!!northCityCorp, 'Dhaka North City Corporation exists under Dhaka district', JSON.stringify(northCityCorp));

const savarUnionsEn = getUnions(savarUpazila!.value, 'en');
const savarUnionsBn = getUnions(savarUpazila!.value);
assert(!!savarUnionsEn && savarUnionsEn.length > 0, 'Savar upazila has unions', `Found ${savarUnionsEn?.length}`);
assert(
  !!savarUnionsBn && !!savarUnionsEn && savarUnionsBn.length === savarUnionsEn.length,
  'Savar BN union list matches EN count',
  `EN=${savarUnionsEn?.length ?? 0}, BN=${savarUnionsBn?.length ?? 0}`
);

const northCityWards = getUnions(northCityCorp!.value, 'en');
assert(!!northCityWards && northCityWards.length > 0, 'Dhaka North City Corporation has wards/thanas', `Found ${northCityWards?.length}`);
const gulshanWard = northCityWards?.find((w) => w.title.toLowerCase() === 'gulshan');
assert(!!gulshanWard, 'Gulshan exists under Dhaka North City Corporation', JSON.stringify(gulshanWard));

// -------------------------------------------------------------
// Test Suite 2: Server-Side Location Hierarchy Validator
// -------------------------------------------------------------
console.log('\n--- TEST SUITE 2: Server-Side validateLocationHierarchy ---');

// Valid by numeric IDs with Union
const validRes1 = validateLocationHierarchy(dhakaDiv!.value, dhakaDistrict!.value, savarUpazila!.value, savarUnionsEn![0].value);
assert(
  validRes1.isValid && Boolean(validRes1.unionTitleEn) && Boolean(validRes1.unionTitleBn),
  'Valid Savar location with union passes & resolves EN/BN titles',
  validRes1.message
);

// Valid Urban City Corp + Ward (Gulshan)
const validRes2 = validateLocationHierarchy(dhakaDiv!.value, dhakaDistrict!.value, northCityCorp!.value, gulshanWard!.value);
assert(validRes2.isValid, 'Valid Dhaka North City Corp -> Gulshan passes validation', validRes2.message);

// Valid Bangla title lookup
const validResBn = validateLocationHierarchy(dhakaDivBn!.title, 'ঢাকা', 'সাভার', savarUnionsBn![0].title);
assert(
  validResBn.isValid && validResBn.divisionId === '30' && validResBn.upazilaId === String(savarUpazila!.value),
  'Valid Bangla title hierarchy resolves canonical IDs',
  validResBn.message
);

// Mandatory Union Check: Savar has unions, omitting union MUST fail
const missingUnionSavar = validateLocationHierarchy('Dhaka', 'Dhaka', 'Savar');
assert(!missingUnionSavar.isValid, 'Savar without required union is rejected', missingUnionSavar.message);

// Valid String Titles WITH Union MUST pass
const validStringWithUnion = validateLocationHierarchy('Dhaka', 'Dhaka', 'Savar', savarUnionsEn![0].title);
assert(validStringWithUnion.isValid, 'String titles ("Dhaka", "Dhaka", "Savar", valid union) passes validation', validStringWithUnion.message);

// Invalid Union under Savar MUST fail
const invalidUnionSavar = validateLocationHierarchy('Dhaka', 'Dhaka', 'Savar', 'Non-Existent-Union-999');
assert(!invalidUnionSavar.isValid, 'Non-existent union under Savar is rejected', invalidUnionSavar.message);

// Scan dataset dynamically for any upazila with 0 unions to test hasUnions === false branch
let zeroUnionExample: { divId: string | number; distId: string | number; upzId: string | number; title: string } | null = null;
for (const div of divisionsEn) {
  for (const dist of getDistricts(div.value, 'en') || []) {
    for (const upz of getUpazilas(dist.value, 'en') || []) {
      const unions = getUnions(upz.value, 'en') || [];
      if (unions.length === 0) {
        zeroUnionExample = { divId: div.value, distId: dist.value, upzId: upz.value, title: upz.title };
        break;
      }
    }
    if (zeroUnionExample) break;
  }
  if (zeroUnionExample) break;
}

if (zeroUnionExample) {
  const zeroUnionRes = validateLocationHierarchy(zeroUnionExample.divId, zeroUnionExample.distId, zeroUnionExample.upzId);
  assert(
    zeroUnionRes.isValid && zeroUnionRes.hasUnions === false,
    `Upazila "${zeroUnionExample.title}" without child unions passes without union selection`,
    zeroUnionRes.message
  );
} else {
  console.log('[INFO] Every upazila in bd-divisions-to-unions contains >= 1 union/ward entry.');
}

// Cross-level Mismatches
const invalidRes1 = validateLocationHierarchy(10, 26, 365);
assert(!invalidRes1.isValid, 'Division-District mismatch is rejected', invalidRes1.message);

const invalidRes2 = validateLocationHierarchy(30, 15, 365);
assert(!invalidRes2.isValid, 'District-Upazila mismatch is rejected', invalidRes2.message);

const invalidRes3 = validateLocationHierarchy('Atlantis', 'Dhaka', 'Savar');
assert(!invalidRes3.isValid, 'Non-existent division is rejected', invalidRes3.message);

// -------------------------------------------------------------
// Test Suite 3: Bangladesh Phone & Postal Validation
// -------------------------------------------------------------
console.log('\n--- TEST SUITE 3: Bangladesh Phone & Postal Code Rules ---');
assert(isValidBdPhone('01712345678'), 'Accepts standard 11-digit BD mobile');
assert(isValidBdPhone('+8801812-345678'), 'Accepts +880 prefixed BD mobile with dash');
assert(normalizeBdPhone('+88 01912-345678') === '01912345678', 'Normalizes +88 formatted phone to 11 digits');
assert(!isValidBdPhone('01212345678'), 'Rejects invalid BD operator prefix 012');
assert(!isValidBdPhone('017123456'), 'Rejects truncated phone number');
assert(isValidBdPostalCode('1205'), 'Accepts 4-digit BD postal code');
assert(!isValidBdPostalCode('12345'), 'Rejects 5-digit postal code');
assert(!isValidBdPostalCode('12A5'), 'Rejects alphanumeric postal code');

console.log('\n================================================================');
if (allPassed) {
  console.log('   ALL LOCATION & VALIDATION CHECKS PASSED (100% SUCCESS)       ');
} else {
  console.log('   SOME LOCATION & VALIDATION CHECKS FAILED                     ');
  process.exit(1);
}
console.log('================================================================\n');
