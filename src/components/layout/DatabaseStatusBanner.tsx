import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Database, AlertTriangle, X, ExternalLink, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../services/api';

export const DatabaseStatusBanner: React.FC = () => {
  const [dbStatus, setDbStatus] = useState<{ isConnected: boolean; statusText?: string } | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const checkStatus = async () => {
    setIsChecking(true);
    try {
      const res = await apiRequest('/health');
      if (res.database) {
        setDbStatus(res.database);
      }
    } catch {
      setDbStatus({ isConnected: false, statusText: 'Backend API unreachable' });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  if (isDismissed || !dbStatus || dbStatus.isConnected) {
    return null;
  }

  return (
    <div className="bg-amber-500 text-slate-950 px-4 py-2.5 text-xs font-medium border-b border-amber-600/30 flex items-center justify-between gap-3 shadow-xs relative z-50">
      <div className="flex items-center gap-2.5 max-w-5xl mx-auto flex-1">
        <div className="w-6 h-6 rounded-md bg-black/10 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4 text-slate-950 font-bold" />
        </div>
        <div className="flex-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-bold">MongoDB Atlas Status:</span>
          <span>Disconnected or MONGODB_URI unconfigured in environment.</span>
          <span className="hidden sm:inline text-slate-800">
            Persistent user accounts, real inventory updates, and order placements require an active Atlas cluster.
          </span>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1 font-bold underline hover:text-black ml-1 bg-black/10 px-2 py-0.5 rounded-sm"
          >
            <Database className="w-3 h-3" />
            <span>Open Database Console</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={checkStatus}
          disabled={isChecking}
          title="Refresh connection status"
          className="p-1 hover:bg-black/10 rounded-sm transition-colors text-slate-900"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={() => setIsDismissed(true)}
          title="Dismiss notification"
          className="p-1 hover:bg-black/10 rounded-sm transition-colors text-slate-900"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
