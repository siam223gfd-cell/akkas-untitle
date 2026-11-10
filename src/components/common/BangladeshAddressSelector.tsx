import React, { useState, useEffect, useMemo } from 'react';
import {
  getAllDivision,
  getDistricts,
  getUpazilas,
  getUnions,
  AdminUnit,
} from 'bd-divisions-to-unions';
import {
  MapPin,
  Building,
  Compass,
  Home,
  FileText,
  Languages,
  CheckCircle2,
  AlertCircle,
  Hash,
} from 'lucide-react';

export interface AddressFormData {
  recipientName: string;
  phone: string;
  division: string;
  divisionId?: string | number;
  district: string;
  districtId?: string | number;
  upazila: string;
  upazilaId?: string | number;
  unionOrWard?: string;
  unionId?: string | number;
  locality?: string;
  house?: string;
  road?: string;
  postalCode?: string;
  streetAddress: string;
  deliveryInstructions?: string;
}

interface BangladeshAddressSelectorProps {
  value: AddressFormData;
  onChange: (updated: AddressFormData) => void;
  showRecipientFields?: boolean;
  disabled?: boolean;
}

const BD_PHONE_PATTERN = /^(?:\+?88)?01[3-9]\d{8}$/;
const BD_POSTAL_PATTERN = /^\d{4}$/;

export const BangladeshAddressSelector: React.FC<BangladeshAddressSelectorProps> = ({
  value,
  onChange,
  showRecipientFields = true,
  disabled = false,
}) => {
  // Default to Bangla ('bn') per Bangladesh administrative standard
  const [lang, setLang] = useState<'en' | 'bn'>('bn');

  const divisions = useMemo<AdminUnit[]>(() => {
    return (getAllDivision(lang === 'bn' ? undefined : 'en') || []).map((u) => ({
      value: String(u.value),
      title: u.title,
    }));
  }, [lang]);

  const districts = useMemo<AdminUnit[]>(() => {
    if (!value.divisionId) return [];
    return (getDistricts(value.divisionId, lang === 'bn' ? undefined : 'en') || []).map((u) => ({
      value: String(u.value),
      title: u.title,
    }));
  }, [value.divisionId, lang]);

  const upazilas = useMemo<AdminUnit[]>(() => {
    if (!value.districtId) return [];
    return (getUpazilas(value.districtId, lang === 'bn' ? undefined : 'en') || []).map((u) => ({
      value: String(u.value),
      title: u.title,
    }));
  }, [value.districtId, lang]);

  const unions = useMemo<AdminUnit[]>(() => {
    if (!value.upazilaId) return [];
    return (getUnions(value.upazilaId, lang === 'bn' ? undefined : 'en') || []).map((u) => ({
      value: String(u.value),
      title: u.title,
    }));
  }, [value.upazilaId, lang]);

  const hasUnions = unions.length > 0;

  // Auto-resolve missing canonical IDs when pre-filled with EN or BN administrative names
  useEffect(() => {
    let changed = false;
    const updated = { ...value };
    const divsEn = getAllDivision('en') || [];
    const divsBn = getAllDivision() || [];

    if (value.division && !value.divisionId) {
      const target = value.division.trim().toLowerCase();
      const matchEn = divsEn.find((d) => d.title.trim().toLowerCase() === target);
      const matchBn = divsBn.find((d) => d.title.trim() === value.division.trim());
      const resolved = matchEn || matchBn;
      if (resolved) {
        updated.divisionId = String(resolved.value);
        const localized = divisions.find((d) => String(d.value) === String(resolved.value));
        updated.division = localized?.title || resolved.title;
        changed = true;
      }
    }

    if (updated.divisionId && value.district && !value.districtId) {
      const target = value.district.trim().toLowerCase();
      const distsEn = getDistricts(updated.divisionId, 'en') || [];
      const distsBn = getDistricts(updated.divisionId) || [];
      const matchEn = distsEn.find((d) => d.title.trim().toLowerCase() === target);
      const matchBn = distsBn.find((d) => d.title.trim() === value.district.trim());
      const resolved = matchEn || matchBn;
      if (resolved) {
        updated.districtId = String(resolved.value);
        const localized = (getDistricts(updated.divisionId, lang === 'bn' ? undefined : 'en') || []).find(
          (d) => String(d.value) === String(resolved.value)
        );
        updated.district = localized?.title || resolved.title;
        changed = true;
      }
    }

    if (updated.districtId && value.upazila && !value.upazilaId) {
      const target = value.upazila.trim().toLowerCase();
      const upzEn = getUpazilas(updated.districtId, 'en') || [];
      const upzBn = getUpazilas(updated.districtId) || [];
      const matchEn = upzEn.find((u) => u.title.trim().toLowerCase() === target);
      const matchBn = upzBn.find((u) => u.title.trim() === value.upazila.trim());
      const resolved = matchEn || matchBn;
      if (resolved) {
        updated.upazilaId = String(resolved.value);
        const localized = (getUpazilas(updated.districtId, lang === 'bn' ? undefined : 'en') || []).find(
          (u) => String(u.value) === String(resolved.value)
        );
        updated.upazila = localized?.title || resolved.title;
        changed = true;
      }
    }

    if (updated.upazilaId && value.unionOrWard && !value.unionId) {
      const target = value.unionOrWard.trim().toLowerCase();
      const unEn = getUnions(updated.upazilaId, 'en') || [];
      const unBn = getUnions(updated.upazilaId) || [];
      const matchEn = unEn.find((u) => u.title.trim().toLowerCase() === target);
      const matchBn = unBn.find((u) => u.title.trim() === value.unionOrWard?.trim());
      const resolved = matchEn || matchBn;
      if (resolved) {
        updated.unionId = String(resolved.value);
        const localized = (getUnions(updated.upazilaId, lang === 'bn' ? undefined : 'en') || []).find(
          (u) => String(u.value) === String(resolved.value)
        );
        updated.unionOrWard = localized?.title || resolved.title;
        changed = true;
      }
    }

    if (changed) {
      onChange(updated);
    }
  }, [value.division, value.district, value.upazila, value.unionOrWard, divisions, lang]);

  // Synchronize ALL 4 cascading level labels immediately when toggling EN <-> BN
  useEffect(() => {
    const next = { ...value };
    let changed = false;

    if (value.divisionId) {
      const matchDiv = divisions.find((d) => String(d.value) === String(value.divisionId));
      if (matchDiv && matchDiv.title !== value.division) {
        next.division = matchDiv.title;
        changed = true;
      }
    }
    if (value.districtId) {
      const matchDist = districts.find((d) => String(d.value) === String(value.districtId));
      if (matchDist && matchDist.title !== value.district) {
        next.district = matchDist.title;
        changed = true;
      }
    }
    if (value.upazilaId) {
      const matchUpz = upazilas.find((u) => String(u.value) === String(value.upazilaId));
      if (matchUpz && matchUpz.title !== value.upazila) {
        next.upazila = matchUpz.title;
        changed = true;
      }
    }
    if (value.unionId && unions.length > 0) {
      const matchUn = unions.find((un) => String(un.value) === String(value.unionId));
      if (matchUn && matchUn.title !== value.unionOrWard) {
        next.unionOrWard = matchUn.title;
        changed = true;
      }
    }

    if (changed) {
      onChange(next);
    }
  }, [lang, divisions, districts, upazilas, unions]);

  const handleDivisionChange = (divisionValue: string) => {
    if (!divisionValue) {
      onChange({
        ...value,
        division: '',
        divisionId: undefined,
        district: '',
        districtId: undefined,
        upazila: '',
        upazilaId: undefined,
        unionOrWard: '',
        unionId: undefined,
      });
      return;
    }

    const selected = divisions.find((d) => String(d.value) === String(divisionValue));
    onChange({
      ...value,
      division: selected?.title || '',
      divisionId: divisionValue,
      district: '',
      districtId: undefined,
      upazila: '',
      upazilaId: undefined,
      unionOrWard: '',
      unionId: undefined,
    });
  };

  const handleDistrictChange = (districtValue: string) => {
    if (!districtValue) {
      onChange({
        ...value,
        district: '',
        districtId: undefined,
        upazila: '',
        upazilaId: undefined,
        unionOrWard: '',
        unionId: undefined,
      });
      return;
    }

    const selected = districts.find((d) => String(d.value) === String(districtValue));
    onChange({
      ...value,
      district: selected?.title || '',
      districtId: districtValue,
      upazila: '',
      upazilaId: undefined,
      unionOrWard: '',
      unionId: undefined,
    });
  };

  const handleUpazilaChange = (upazilaValue: string) => {
    if (!upazilaValue) {
      onChange({
        ...value,
        upazila: '',
        upazilaId: undefined,
        unionOrWard: '',
        unionId: undefined,
      });
      return;
    }

    const selected = upazilas.find((u) => String(u.value) === String(upazilaValue));
    onChange({
      ...value,
      upazila: selected?.title || '',
      upazilaId: upazilaValue,
      unionOrWard: '',
      unionId: undefined,
    });
  };

  const handleUnionChange = (unionValue: string) => {
    if (!unionValue) {
      onChange({
        ...value,
        unionOrWard: '',
        unionId: undefined,
      });
      return;
    }

    const selected = unions.find((un) => String(un.value) === String(unionValue));
    onChange({
      ...value,
      unionOrWard: selected?.title || '',
      unionId: unionValue,
    });
  };

  const sanitizedPhone = (value.phone || '').replace(/[\s\-().]/g, '').trim();
  const isPhoneInvalid = sanitizedPhone.length > 0 && !BD_PHONE_PATTERN.test(sanitizedPhone);
  const trimmedPostal = (value.postalCode || '').trim();
  const isPostalInvalid = trimmedPostal.length > 0 && !BD_POSTAL_PATTERN.test(trimmedPostal);

  return (
    <div className="space-y-4">
      {/* Language Switcher Bar */}
      <div className="flex items-center justify-between bg-blue-50/60 p-2.5 rounded-xl border border-blue-100/80">
        <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
          <Languages className="w-3.5 h-3.5 text-blue-600" />
          <span>{lang === 'bn' ? 'বাংলাদেশ প্রশাসনিক অঞ্চল নির্বাচন' : 'Bangladesh Administrative Location'}</span>
        </div>
        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-blue-200/60 shadow-2xs">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setLang('en')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
              lang === 'en'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            English
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setLang('bn')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
              lang === 'bn'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            বাংলা
          </button>
        </div>
      </div>

      {/* Recipient Information */}
      {showRecipientFields && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {lang === 'bn' ? 'প্রাপকের নাম (Recipient Name)' : 'Recipient Full Name'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={disabled}
              value={value.recipientName}
              onChange={(e) => onChange({ ...value, recipientName: e.target.value })}
              placeholder={lang === 'bn' ? 'প্রাপকের পুরো নাম' : 'e.g. Md. Mahim'}
              className="w-full px-3.5 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {lang === 'bn' ? 'মোবাইল নম্বর (BD Mobile)' : 'Mobile Contact Number'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              required
              disabled={disabled}
              value={value.phone}
              onChange={(e) => onChange({ ...value, phone: e.target.value })}
              placeholder={lang === 'bn' ? '01712345678 বা +8801712345678' : '01712345678 or +880 1712 345678'}
              className={`w-full px-3.5 py-2.5 bg-slate-50/60 border rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 transition-all disabled:opacity-60 ${
                isPhoneInvalid
                  ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                  : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-600'
              }`}
            />
            {isPhoneInvalid && (
              <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3 h-3 shrink-0" />
                {lang === 'bn'
                  ? 'সঠিক ১১ সংখ্যার বাংলাদেশী মোবাইল নম্বর দিন (যেমনঃ 017XXXXXXXX)'
                  : 'Enter a valid 11-digit Bangladesh mobile number (e.g. 017XXXXXXXX)'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Cascading Dropdowns: 2x2 Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 1. Division Dropdown */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            {lang === 'bn' ? 'বিভাগ (Division)' : 'Division'} <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Compass className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              required
              disabled={disabled}
              value={value.divisionId ? String(value.divisionId) : ''}
              onChange={(e) => handleDivisionChange(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all appearance-none cursor-pointer disabled:opacity-50"
            >
              <option value="">{lang === 'bn' ? '-- বিভাগ নির্বাচন করুন --' : '-- Select Division --'}</option>
              {divisions.map((div) => (
                <option key={String(div.value)} value={String(div.value)}>
                  {div.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 2. District Dropdown */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            {lang === 'bn' ? 'জেলা (District)' : 'District'} <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              required
              disabled={disabled || !value.divisionId}
              value={value.districtId ? String(value.districtId) : ''}
              onChange={(e) => handleDistrictChange(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {!value.divisionId
                  ? lang === 'bn'
                    ? 'আগে বিভাগ নির্বাচন করুন'
                    : 'Select Division first'
                  : lang === 'bn'
                  ? '-- জেলা নির্বাচন করুন --'
                  : '-- Select District --'}
              </option>
              {districts.map((dist) => (
                <option key={String(dist.value)} value={String(dist.value)}>
                  {dist.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. Upazila / Thana Dropdown */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            {lang === 'bn' ? 'উপজেলা / থানা (Upazila/Thana)' : 'Upazila / Thana'}{' '}
            <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              required
              disabled={disabled || !value.districtId}
              value={value.upazilaId ? String(value.upazilaId) : ''}
              onChange={(e) => handleUpazilaChange(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {!value.districtId
                  ? lang === 'bn'
                    ? 'আগে জেলা নির্বাচন করুন'
                    : 'Select District first'
                  : lang === 'bn'
                  ? '-- উপজেলা/থানা নির্বাচন করুন --'
                  : '-- Select Upazila / Thana --'}
              </option>
              {upazilas.map((upz) => (
                <option key={String(upz.value)} value={String(upz.value)}>
                  {upz.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4. Union / Ward Dropdown (or Area Input if Upazila has no unions) */}
        <div>
          <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
            <span>
              {hasUnions
                ? lang === 'bn'
                  ? 'ইউনিয়ন / ওয়ার্ড (Union/Ward)'
                  : 'Union / Ward'
                : lang === 'bn'
                ? 'এলাকা / ওয়ার্ড (Area / Ward)'
                : 'Area / Ward / Locality'}
              {hasUnions && <span className="text-rose-500 ml-1">*</span>}
            </span>
            {!hasUnions && value.upazilaId && (
              <span className="text-[10px] text-blue-600 font-semibold">Urban / Optional Ward</span>
            )}
          </label>

          {hasUnions ? (
            <div className="relative">
              <Home className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                required={hasUnions}
                disabled={disabled || !value.upazilaId}
                value={value.unionId ? String(value.unionId) : ''}
                onChange={(e) => handleUnionChange(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">
                  {!value.upazilaId
                    ? lang === 'bn'
                      ? 'আগে উপজেলা নির্বাচন করুন'
                      : 'Select Upazila first'
                    : lang === 'bn'
                    ? '-- ইউনিয়ন / ওয়ার্ড নির্বাচন করুন --'
                    : '-- Select Union / Ward --'}
                </option>
                {unions.map((un) => (
                  <option key={String(un.value)} value={String(un.value)}>
                    {un.title}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="relative">
              <Home className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                disabled={disabled || !value.upazilaId}
                value={value.unionOrWard || ''}
                onChange={(e) => onChange({ ...value, unionOrWard: e.target.value, unionId: undefined })}
                placeholder={
                  !value.upazilaId
                    ? lang === 'bn'
                      ? 'আগে উপজেলা নির্বাচন করুন'
                      : 'Select Upazila first'
                    : lang === 'bn'
                    ? 'ওয়ার্ড নম্বর বা এলাকার নাম (যেমনঃ সেক্টর ৩, ওয়ার্ড ১২)'
                    : 'Ward # / Area (e.g. Ward 18, Sector 4)'
                }
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all disabled:opacity-50"
              />
            </div>
          )}
        </div>
      </div>

      {/* Selected Location Breadcrumb Feedback */}
      {value.division && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-600 bg-slate-100/70 px-3 py-1.5 rounded-lg border border-slate-200/60">
          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Hierarchy:</span>
          <span className="font-bold text-slate-800">{value.division}</span>
          {value.district && (
            <>
              <span className="text-slate-400">›</span>
              <span className="font-bold text-slate-800">{value.district}</span>
            </>
          )}
          {value.upazila && (
            <>
              <span className="text-slate-400">›</span>
              <span className="font-bold text-slate-800">{value.upazila}</span>
            </>
          )}
          {value.unionOrWard && (
            <>
              <span className="text-slate-400">›</span>
              <span className="font-bold text-blue-700">{value.unionOrWard}</span>
            </>
          )}
        </div>
      )}

      {/* Detailed Delivery Address Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Locality / Para / Area */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            {lang === 'bn' ? 'এলাকা / পাড়া / মহল্লা' : 'Locality / Area / Para'}
          </label>
          <input
            type="text"
            disabled={disabled}
            value={value.locality || ''}
            onChange={(e) => onChange({ ...value, locality: e.target.value })}
            placeholder={lang === 'bn' ? 'যেমনঃ বনানী ডিওএইচএস' : 'e.g. Banani Block C'}
            className="w-full px-3.5 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all disabled:opacity-60"
          />
        </div>

        {/* House / Holding */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            {lang === 'bn' ? 'বাড়ি / ফ্ল্যাট নম্বর' : 'House / Flat #'}
          </label>
          <input
            type="text"
            disabled={disabled}
            value={value.house || ''}
            onChange={(e) => onChange({ ...value, house: e.target.value })}
            placeholder="e.g. House 42, Flat 4B"
            className="w-full px-3.5 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all disabled:opacity-60"
          />
        </div>

        {/* Road / Street */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            {lang === 'bn' ? 'রাস্তা / লেন' : 'Road / Street'}
          </label>
          <input
            type="text"
            disabled={disabled}
            value={value.road || ''}
            onChange={(e) => onChange({ ...value, road: e.target.value })}
            placeholder="e.g. Road 11, Block D"
            className="w-full px-3.5 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all disabled:opacity-60"
          />
        </div>

        {/* Postal Code */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            {lang === 'bn' ? 'পোস্ট কোড (৪ সংখ্যা)' : 'Postal Code (4 digits)'}
          </label>
          <div className="relative">
            <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              maxLength={4}
              disabled={disabled}
              value={value.postalCode || ''}
              onChange={(e) => onChange({ ...value, postalCode: e.target.value })}
              placeholder="e.g. 1212"
              className={`w-full pl-9 pr-3.5 py-2.5 bg-slate-50/60 border rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 transition-all disabled:opacity-60 ${
                isPostalInvalid
                  ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                  : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-600'
              }`}
            />
          </div>
          {isPostalInvalid && (
            <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {lang === 'bn' ? '৪ সংখ্যার পোস্ট কোড দিন' : 'Must be a 4-digit postal code'}
            </p>
          )}
        </div>
      </div>

      {/* Full Street Address (Required) */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">
          {lang === 'bn' ? 'বিস্তারিত ঠিকানা (Street Address)' : 'Full Detailed Address'}{' '}
          <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <textarea
            required
            rows={2}
            disabled={disabled}
            value={value.streetAddress}
            onChange={(e) => onChange({ ...value, streetAddress: e.target.value })}
            placeholder={
              lang === 'bn'
                ? 'বাড়ি নম্বর, রোড নম্বর, এলাকার বিবরণ ও ল্যান্ডমার্ক...'
                : 'House, Road, Area details, Landmark (e.g. Beside Gulshan Lake Park)...'
            }
            className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all disabled:opacity-60 resize-none"
          />
        </div>
      </div>

      {/* Delivery Instructions (Optional) */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">
          {lang === 'bn' ? 'ডেলিভারি সংক্রান্ত নির্দেশনা (ঐচ্ছিক)' : 'Delivery Instructions (Optional)'}
        </label>
        <input
          type="text"
          disabled={disabled}
          value={value.deliveryInstructions || ''}
          onChange={(e) => onChange({ ...value, deliveryInstructions: e.target.value })}
          placeholder="e.g. Call before delivery / Leave at reception"
          className="w-full px-3.5 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all disabled:opacity-60"
        />
      </div>
    </div>
  );
};
