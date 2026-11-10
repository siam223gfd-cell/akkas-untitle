import { Router, Request, Response } from 'express';
import {
  getAllDivision,
  getDistricts,
  getUpazilas,
  getUnions,
  AdminUnit,
} from 'bd-divisions-to-unions';

export const locationsRouter = Router();

export interface LocationValidationResult {
  isValid: boolean;
  message?: string;
  divisionId?: string;
  districtId?: string;
  upazilaId?: string;
  unionId?: string;
  divisionTitle?: string;
  divisionTitleEn?: string;
  divisionTitleBn?: string;
  districtTitle?: string;
  districtTitleEn?: string;
  districtTitleBn?: string;
  upazilaTitle?: string;
  upazilaTitleEn?: string;
  upazilaTitleBn?: string;
  unionTitle?: string;
  unionTitleEn?: string;
  unionTitleBn?: string;
  hasUnions?: boolean;
}

function normalizeUnits(units: AdminUnit[] | undefined | null): AdminUnit[] {
  return (units || []).map((u) => ({
    value: String(u.value),
    title: u.title,
  }));
}

function findUnitMatch(
  val: string | number | undefined | null,
  enList: AdminUnit[],
  bnList: AdminUnit[]
): { en?: AdminUnit; bn?: AdminUnit } | null {
  if (val === undefined || val === null || String(val).trim() === '') return null;
  const target = String(val).trim();
  const targetLower = target.toLowerCase();

  const enMatch = enList.find(
    (u) => String(u.value) === target || u.title.trim().toLowerCase() === targetLower
  );
  if (enMatch) {
    const bnMatch = bnList.find((b) => String(b.value) === String(enMatch.value));
    return { en: enMatch, bn: bnMatch };
  }

  const bnMatch = bnList.find(
    (u) => String(u.value) === target || u.title.trim() === target
  );
  if (bnMatch) {
    const corrEn = enList.find((e) => String(e.value) === String(bnMatch.value));
    return { en: corrEn, bn: bnMatch };
  }

  return null;
}

/**
 * Validates a submitted administrative location hierarchy using bd-divisions-to-unions authoritative data.
 */
export function validateLocationHierarchy(
  divisionVal: string | number,
  districtVal: string | number,
  upazilaVal: string | number,
  unionVal?: string | number | null
): LocationValidationResult {
  const divsEn = normalizeUnits(getAllDivision('en'));
  const divsBn = normalizeUnits(getAllDivision());

  const divMatch = findUnitMatch(divisionVal, divsEn, divsBn);
  if (!divMatch || (!divMatch.en && !divMatch.bn)) {
    return {
      isValid: false,
      message: `Invalid Division: "${divisionVal}". Please select a valid Bangladesh Division.`,
    };
  }
  const divId = String((divMatch.en || divMatch.bn)!.value);

  const distsEn = normalizeUnits(getDistricts(divId, 'en'));
  const distsBn = normalizeUnits(getDistricts(divId));

  const distMatch = findUnitMatch(districtVal, distsEn, distsBn);
  if (!distMatch || (!distMatch.en && !distMatch.bn)) {
    return {
      isValid: false,
      message: `District "${districtVal}" does not belong to Division "${(divMatch.en || divMatch.bn)!.title}".`,
    };
  }
  const distId = String((distMatch.en || distMatch.bn)!.value);

  const upzEn = normalizeUnits(getUpazilas(distId, 'en'));
  const upzBn = normalizeUnits(getUpazilas(distId));

  let upzMatch = findUnitMatch(upazilaVal, upzEn, upzBn);
  let resolvedWardFromUpazila: string | undefined = undefined;

  if (!upzMatch || (!upzMatch.en && !upzMatch.bn)) {
    // Check if upazilaVal matches a known ward/thana under one of the district's upazilas/city corporations
    for (const upz of upzEn) {
      const childUnionsEn = normalizeUnits(getUnions(String(upz.value), 'en'));
      const childUnionsBn = normalizeUnits(getUnions(String(upz.value)));
      const wardMatch = findUnitMatch(upazilaVal, childUnionsEn, childUnionsBn);
      if (wardMatch && (wardMatch.en || wardMatch.bn)) {
        upzMatch = { en: upz, bn: upzBn.find((u) => String(u.value) === String(upz.value)) };
        resolvedWardFromUpazila = (wardMatch.en || wardMatch.bn)!.title;
        break;
      }
    }
  }

  if (!upzMatch || (!upzMatch.en && !upzMatch.bn)) {
    return {
      isValid: false,
      message: `Upazila/Thana "${upazilaVal}" does not belong to District "${(distMatch.en || distMatch.bn)!.title}".`,
    };
  }
  const upzId = String((upzMatch.en || upzMatch.bn)!.value);
  const upazilaLabel = (upzMatch.en || upzMatch.bn)!.title;

  const unionsEn = normalizeUnits(getUnions(upzId, 'en'));
  const unionsBn = normalizeUnits(getUnions(upzId));
  const hasUnions = unionsEn.length > 0 || unionsBn.length > 0;

  let unionId: string | undefined = undefined;
  let unionTitle: string | undefined = undefined;
  let unionTitleEn: string | undefined = undefined;
  let unionTitleBn: string | undefined = undefined;

  let trimmedUnion = unionVal !== undefined && unionVal !== null ? String(unionVal).trim() : '';
  if (!trimmedUnion && resolvedWardFromUpazila) {
    trimmedUnion = resolvedWardFromUpazila;
  }

  if (hasUnions) {
    if (!trimmedUnion) {
      return {
        isValid: false,
        message: `Union/Ward is required for Upazila/City Corp "${upazilaLabel}".`,
      };
    }
    const unionMatch = findUnitMatch(trimmedUnion, unionsEn, unionsBn);
    if (!unionMatch || (!unionMatch.en && !unionMatch.bn)) {
      return {
        isValid: false,
        message: `Union/Ward "${trimmedUnion}" does not belong to Upazila "${upazilaLabel}".`,
      };
    }
    unionId = String((unionMatch.en || unionMatch.bn)!.value);
    unionTitleEn = unionMatch.en?.title;
    unionTitleBn = unionMatch.bn?.title;
    unionTitle = unionTitleEn || unionTitleBn;
  } else if (trimmedUnion) {
    unionTitle = trimmedUnion;
    unionTitleEn = trimmedUnion;
    unionTitleBn = trimmedUnion;
  }

  return {
    isValid: true,
    divisionId: divId,
    districtId: distId,
    upazilaId: upzId,
    unionId,
    divisionTitle: divMatch.en?.title || divMatch.bn?.title,
    divisionTitleEn: divMatch.en?.title,
    divisionTitleBn: divMatch.bn?.title,
    districtTitle: distMatch.en?.title || distMatch.bn?.title,
    districtTitleEn: distMatch.en?.title,
    districtTitleBn: distMatch.bn?.title,
    upazilaTitle: upazilaLabel,
    upazilaTitleEn: upzMatch.en?.title,
    upazilaTitleBn: upzMatch.bn?.title,
    unionTitle,
    unionTitleEn,
    unionTitleBn,
    hasUnions,
  };
}

// GET /api/locations/divisions
locationsRouter.get('/divisions', (req: Request, res: Response) => {
  const lang = req.query.lang === 'en' ? 'en' : req.query.lang === 'bn' ? undefined : 'en';
  const divisions = normalizeUnits(getAllDivision(lang));
  res.json({
    success: true,
    divisions,
  });
});

// GET /api/locations/districts/:divisionValue
locationsRouter.get('/districts/:divisionValue', (req: Request, res: Response) => {
  const lang = req.query.lang === 'bn' ? undefined : 'en';
  const divisionValue = String(req.params.divisionValue || '').trim();
  const divisionExists = (getAllDivision('en') || []).some((d) => String(d.value) === divisionValue);
  if (!divisionExists) {
    return res.status(400).json({ success: false, message: `Invalid division identifier "${divisionValue}".` });
  }
  const districts = normalizeUnits(getDistricts(divisionValue, lang));
  res.json({
    success: true,
    districts,
  });
});

// GET /api/locations/upazilas/:districtValue
locationsRouter.get('/upazilas/:districtValue', (req: Request, res: Response) => {
  const lang = req.query.lang === 'bn' ? undefined : 'en';
  const districtValue = String(req.params.districtValue || '').trim();
  const districtExists = (getAllDivision('en') || []).some((div) =>
    (getDistricts(div.value, 'en') || []).some((dist) => String(dist.value) === districtValue)
  );
  if (!districtExists) {
    return res.status(400).json({ success: false, message: `Invalid district identifier "${districtValue}".` });
  }
  const upazilas = normalizeUnits(getUpazilas(districtValue, lang));
  res.json({
    success: true,
    upazilas,
  });
});

// GET /api/locations/unions/:upazilaValue
locationsRouter.get('/unions/:upazilaValue', (req: Request, res: Response) => {
  const lang = req.query.lang === 'bn' ? undefined : 'en';
  const upazilaValue = String(req.params.upazilaValue || '').trim();
  const upazilaExists = (getAllDivision('en') || []).some((div) =>
    (getDistricts(div.value, 'en') || []).some((dist) =>
      (getUpazilas(dist.value, 'en') || []).some((upz) => String(upz.value) === upazilaValue)
    )
  );
  if (!upazilaExists) {
    return res.status(400).json({ success: false, message: `Invalid upazila identifier "${upazilaValue}".` });
  }
  const unions = normalizeUnits(getUnions(upazilaValue, lang));
  res.json({
    success: true,
    unions,
    hasUnions: unions.length > 0,
  });
});
