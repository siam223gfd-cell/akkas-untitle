import React, { useState, useRef } from 'react';
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  FileCode,
  Layers,
  ShoppingBag,
  Tag,
  PackageCheck,
  Star,
  Image as ImageIcon,
  Check,
  X,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useAppDispatch } from '../../app/hooks';
import { addToast } from '../../features/ui/uiSlice';

interface ValidationResult {
  valid: boolean;
  exportDate: string;
  platform: string;
  counts: Record<string, number | boolean>;
  totalRecords: number;
  message: string;
}

export const BackupManager: React.FC = () => {
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastExport, setLastExport] = useState<any>(null);

  // Restore states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedBackup, setParsedBackup] = useState<any>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [restoreSummary, setRestoreSummary] = useState<Record<string, number> | null>(null);

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const res = await apiRequest('/admin/backup/export', { method: 'POST' });
      setIsExporting(false);

      if (res.success && res.backup) {
        setLastExport(res.backup);
        // Trigger browser download of JSON snapshot
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.backup, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataStr);
        downloadAnchor.setAttribute('download', `novara_backup_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();

        dispatch(
          addToast({
            type: 'success',
            title: 'Database Backup Generated',
            message: `JSON snapshot containing ${res.backup.counts?.products || 0} products downloaded.`,
          })
        );
      } else {
        dispatch(
          addToast({
            type: 'error',
            title: 'Backup Failed',
            message: res.message || 'Could not export database snapshot.',
          })
        );
      }
    } catch (err: any) {
      setIsExporting(false);
      dispatch(
        addToast({
          type: 'error',
          title: 'Export Error',
          message: err.message || 'An unexpected error occurred during backup generation.',
        })
      );
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Invalid File Format',
          message: 'Please select a valid JSON backup file (.json).',
        })
      );
      return;
    }

    setSelectedFile(file);
    setRestoreSummary(null);
    setValidationResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setParsedBackup(json);
        validateBackupFile(json);
      } catch (err) {
        dispatch(
          addToast({
            type: 'error',
            title: 'JSON Parse Error',
            message: 'Selected file could not be parsed as valid JSON.',
          })
        );
        setSelectedFile(null);
        setParsedBackup(null);
      }
    };
    reader.readAsText(file);
  };

  const validateBackupFile = async (backupData: any) => {
    setIsValidating(true);
    try {
      const res = await apiRequest('/admin/backup/validate', {
        method: 'POST',
        body: JSON.stringify({ backup: backupData }),
      });
      setIsValidating(false);

      if (res.success && res.valid) {
        setValidationResult(res as any);
        dispatch(
          addToast({
            type: 'success',
            title: 'Backup Validated',
            message: `Validated package with ${res.totalRecords} records across catalog and store.`,
          })
        );
      } else {
        setValidationResult(null);
        dispatch(
          addToast({
            type: 'error',
            title: 'Validation Failed',
            message: res.message || 'Backup file schema is invalid or unrecognized.',
          })
        );
      }
    } catch (err: any) {
      setIsValidating(false);
      dispatch(
        addToast({
          type: 'error',
          title: 'Validation Request Failed',
          message: err.message || 'Failed to reach server for backup validation.',
        })
      );
    }
  };

  const handleExecuteRestore = async () => {
    if (!parsedBackup) return;

    setShowConfirmModal(false);
    setIsRestoring(true);

    try {
      const res = await apiRequest('/admin/backup/restore', {
        method: 'POST',
        body: JSON.stringify({
          backup: parsedBackup,
          confirm: true,
        }),
      });

      setIsRestoring(false);

      if (res.success) {
        setRestoreSummary(res.restored);
        dispatch(
          addToast({
            type: 'success',
            title: 'Database Restored Successfully',
            message: `Restoration complete. ${res.totalRestored} database records synchronized.`,
          })
        );
      } else {
        dispatch(
          addToast({
            type: 'error',
            title: 'Restoration Failed',
            message: res.message || 'Database restoration encountered an error.',
          })
        );
      }
    } catch (err: any) {
      setIsRestoring(false);
      dispatch(
        addToast({
          type: 'error',
          title: 'Restoration Error',
          message: err.message || 'Failed to complete restore operation.',
        })
      );
    }
  };

  const handleResetFile = () => {
    setSelectedFile(null);
    setParsedBackup(null);
    setValidationResult(null);
    setRestoreSummary(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Export Action */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Database Backup & Disaster Recovery</h2>
              <p className="text-xs text-slate-500">
                Full-fidelity multi-collection JSON snapshots of products, categories, orders, coupons, CMS, and reviews.
              </p>
            </div>
          </div>

          <button
            onClick={handleExportBackup}
            disabled={isExporting}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all self-start sm:self-auto disabled:opacity-50"
          >
            {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{isExporting ? 'Generating Snapshot...' : 'Export Full Database Backup'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Backup Schema Coverage
            </h4>
            <ul className="space-y-1.5 text-slate-600 list-disc pl-4">
              <li>Products, categories, brands, variants, and custom attributes.</li>
              <li>Customer orders, item line states, shipping addresses, and pricing.</li>
              <li>Promotional coupons, customer reviews, blog posts, and dynamic banners.</li>
              <li>Site CMS configuration, navigation pages, and hero slides.</li>
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-800">Session Export Log</h4>
            {lastExport ? (
              <div className="space-y-1 text-slate-600 font-mono text-[11px]">
                <p><span className="text-slate-400">Export Timestamp:</span> {lastExport.exportDate}</p>
                <p><span className="text-slate-400">Total Products:</span> {lastExport.counts?.products ?? 0}</p>
                <p><span className="text-slate-400">Total Orders:</span> {lastExport.counts?.orders ?? 0}</p>
                <p><span className="text-slate-400">Categories & Brands:</span> {(lastExport.counts?.categories || 0) + (lastExport.counts?.brands || 0)}</p>
              </div>
            ) : (
              <p className="text-slate-400">No snapshot exported during this active browser session.</p>
            )}
          </div>
        </div>
      </div>

      {/* Restore Section */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">Restore Database Snapshot</h2>
            <p className="text-xs text-slate-500">
              Upload a valid Aurelia / Novara JSON backup to preview and synchronize collections.
            </p>
          </div>
        </div>

        {/* File Picker Zone */}
        {!selectedFile ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-3xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-blue-50/30 flex flex-col items-center justify-center gap-3"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileSelect}
            />
            <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-100 text-blue-600 flex items-center justify-center">
              <FileCode className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Select or drop a JSON backup file</p>
              <p className="text-xs text-slate-400 mt-0.5">Compatible with standard Novara / Aurelia JSON exports</p>
            </div>
            <button
              type="button"
              className="mt-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition"
            >
              Browse Files
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-3">
                <FileCode className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-xs font-bold text-slate-800">{selectedFile.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {(selectedFile.size / 1024).toFixed(1)} KB • Selected for restoration
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetFile}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition"
                >
                  Change File
                </button>
              </div>
            </div>

            {/* Validation State */}
            {isValidating && (
              <div className="flex items-center justify-center gap-2 p-6 text-xs text-blue-600 bg-blue-50/50 rounded-2xl">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Verifying backup structure and record integrity...</span>
              </div>
            )}

            {/* Validation Result Preview Card */}
            {validationResult && (
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Backup Verified: Ready to Restore</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    Exported: {new Date(validationResult.exportDate).toLocaleString()}
                  </span>
                </div>

                {/* Counts Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500">Products</span>
                    <span className="font-bold text-slate-900">{String(validationResult.counts?.products ?? 0)}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500">Categories</span>
                    <span className="font-bold text-slate-900">{String(validationResult.counts?.categories ?? 0)}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500">Brands</span>
                    <span className="font-bold text-slate-900">{String(validationResult.counts?.brands ?? 0)}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500">Orders</span>
                    <span className="font-bold text-slate-900">{String(validationResult.counts?.orders ?? 0)}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500">Coupons</span>
                    <span className="font-bold text-slate-900">{String(validationResult.counts?.coupons ?? 0)}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500">Reviews</span>
                    <span className="font-bold text-slate-900">{String(validationResult.counts?.reviews ?? 0)}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500">Hero Slides</span>
                    <span className="font-bold text-slate-900">{String(validationResult.counts?.heroSlides ?? 0)}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500">Banners</span>
                    <span className="font-bold text-slate-900">{String(validationResult.counts?.banners ?? 0)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-slate-600">
                    Total records to upsert: <span className="font-bold text-slate-900">{validationResult.totalRecords}</span>
                  </div>
                  <button
                    onClick={() => setShowConfirmModal(true)}
                    disabled={isRestoring}
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all disabled:opacity-50"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Proceed with Restore</span>
                  </button>
                </div>
              </div>
            )}

            {/* Restore Summary after completion */}
            {restoreSummary && (
              <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Restoration Completed Successfully</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {Object.entries(restoreSummary).map(([key, count]) => (
                    <div key={key} className="bg-white/80 p-2.5 rounded-xl border border-emerald-100 flex items-center justify-between">
                      <span className="text-slate-600 capitalize">{key}</span>
                      <span className="font-bold text-emerald-900">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-slate-900">Confirm Database Restoration</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Restoring a snapshot will <span className="font-bold text-slate-800">upsert and overwrite</span> matching records in your active MongoDB database.
                This action is logged in administrative audit trails.
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1 font-mono text-slate-700">
              <div className="flex justify-between">
                <span>Selected File:</span>
                <span className="font-bold truncate max-w-[180px]">{selectedFile?.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Records:</span>
                <span className="font-bold">{validationResult?.totalRecords ?? 0}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-amber-600/20"
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Restore Database</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
