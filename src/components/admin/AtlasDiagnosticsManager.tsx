import React, { useState, useEffect } from 'react';
import {
  Database,
  RefreshCw,
  Activity,
  Server,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  HardDrive,
  Cpu,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useAppDispatch } from '../../app/hooks';
import { addToast } from '../../features/ui/uiSlice';

interface DiagnosticsData {
  pingLatencyMs?: number;
  serverTime?: string;
  engineVersion?: string;
  uptimeSeconds?: number;
  memoryUsageMb?: number;
  databaseName?: string;
  host?: string;
  probe?: {
    read: boolean;
    write: boolean;
  };
  collections?: Array<{
    name: string;
    count: number;
  }>;
}

interface AtlasDiagnosticsProps {
  onDataRefresh?: () => void;
}

export const AtlasDiagnosticsManager: React.FC<AtlasDiagnosticsProps> = ({ onDataRefresh }) => {
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [databaseInfo, setDatabaseInfo] = useState<any>(null);
  const [customAtlasUri, setCustomAtlasUri] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/health/diagnostics');
      if (res && res.database) {
        setDatabaseInfo(res.database);
        setDiagnostics(res.diagnostics);
      }
    } catch (err: any) {
      console.error('Failed to fetch diagnostics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const handleConnectAtlas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAtlasUri.trim()) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Missing Connection URI',
          message: 'Please enter a valid MongoDB Atlas connection string.',
        })
      );
      return;
    }

    setIsConnecting(true);
    try {
      const res = await apiRequest('/health/connect', {
        method: 'POST',
        body: JSON.stringify({ uri: customAtlasUri.trim(), runSeed: true }),
      });
      setIsConnecting(false);

      if (res.success) {
        dispatch(
          addToast({
            type: 'success',
            title: 'MongoDB Atlas Connected',
            message: 'Successfully established cluster connection & verified collections.',
          })
        );
        fetchDiagnostics();
        if (onDataRefresh) onDataRefresh();
      } else {
        dispatch(
          addToast({
            type: 'error',
            title: 'Connection Failed',
            message: res.message || 'Could not connect to MongoDB Atlas cluster.',
          })
        );
      }
    } catch (err: any) {
      setIsConnecting(false);
      dispatch(
        addToast({
          type: 'error',
          title: 'Connection Error',
          message: err.message || 'Connection request failed.',
        })
      );
    }
  };

  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    try {
      const res = await apiRequest('/health/seed', { method: 'POST' });
      setIsSeeding(false);

      if (res.success) {
        dispatch(
          addToast({
            type: 'success',
            title: 'Database Initialized',
            message: 'Default catalog products, categories, coupons, and CMS hero slides loaded.',
          })
        );
        fetchDiagnostics();
        if (onDataRefresh) onDataRefresh();
      } else {
        dispatch(
          addToast({
            type: 'error',
            title: 'Seeding Error',
            message: res.message || 'Unable to seed database.',
          })
        );
      }
    } catch (err: any) {
      setIsSeeding(false);
      dispatch(
        addToast({
          type: 'error',
          title: 'Seeding Failed',
          message: err.message || 'Could not complete database seeding.',
        })
      );
    }
  };

  const isConnected = databaseInfo?.isConnected;

  return (
    <div className="space-y-6">
      {/* Top Console Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">MongoDB Atlas Diagnostics & Telemetry</h2>
              <p className="text-xs text-slate-500">
                Live cluster connection telemetry, round-trip ping latency, collection counts, and probe verification.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={fetchDiagnostics}
              disabled={loading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Metrics</span>
            </button>
          </div>
        </div>

        {/* Primary Health Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Cluster State</span>
              <Activity className="w-4 h-4 text-purple-600" />
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}
              />
              <span className="text-sm font-black text-slate-900">
                {isConnected ? 'ONLINE' : 'DISCONNECTED'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate font-mono">
              {databaseInfo?.readyStateText || (isConnected ? 'Ready' : 'Not Connected')}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Ping Latency</span>
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-slate-900">
                {diagnostics?.pingLatencyMs !== undefined ? `${diagnostics.pingLatencyMs} ms` : '—'}
              </span>
              {diagnostics?.pingLatencyMs !== undefined && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {diagnostics.pingLatencyMs < 100 ? 'Optimal' : 'Normal'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">Real round-trip admin ping</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Active Host</span>
              <Server className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-xs font-mono font-bold text-slate-800 truncate" title={diagnostics?.host || databaseInfo?.host}>
              {diagnostics?.host || databaseInfo?.host || 'atlas-cluster.mongodb.net'}
            </p>
            <p className="text-[11px] text-slate-500">
              Database: <span className="font-semibold text-slate-700">{diagnostics?.databaseName || databaseInfo?.databaseName || 'novara_commerce'}</span>
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Probe Status</span>
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className={`flex items-center gap-1 ${diagnostics?.probe?.read ? 'text-emerald-700' : 'text-slate-400'}`}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Read
              </span>
              <span className={`flex items-center gap-1 ${diagnostics?.probe?.write ? 'text-emerald-700' : 'text-slate-400'}`}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Write
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono">
              Engine: {diagnostics?.engineVersion || 'MongoDB v7.0'}
            </p>
          </div>
        </div>

        {/* Status Message / Error if disconnected */}
        {!isConnected && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Atlas Connection Pending or Disconnected</p>
              <p className="text-amber-800 leading-relaxed">
                {databaseInfo?.statusText ||
                  'The application is waiting for a valid MongoDB Atlas connection string. Connect your cluster below to persist catalog, customer orders, and staff records.'}
              </p>
              {databaseInfo?.error && (
                <p className="font-mono text-[11px] bg-amber-100/70 p-2 rounded-lg text-amber-950 mt-1">
                  {databaseInfo.error}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Connection Form & Seeder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
            <KeyRound className="w-4 h-4 text-purple-600" />
            <h3>Configure Atlas Connection String</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Supply a standard MongoDB Atlas connection URI (`mongodb+srv://...`) to dynamically reconnect the backend engine without restarting the server container.
          </p>

          <form onSubmit={handleConnectAtlas} className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/novara_commerce"
                value={customAtlasUri}
                onChange={(e) => setCustomAtlasUri(e.target.value)}
                className="flex-1 p-3 bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl text-xs font-mono outline-hidden"
              />
              <button
                type="submit"
                disabled={isConnecting}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition whitespace-nowrap shadow-md shadow-purple-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isConnecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
                <span>{isConnecting ? 'Testing & Connecting...' : 'Connect to Atlas'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              * Password and secret credentials are automatically masked in all server audit logs and telemetry responses.
            </p>
          </form>
        </div>

        {/* Database Seeder */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3>Seed Catalog & Demo Data</h3>
            </div>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Populate empty MongoDB Atlas collections with baseline products, categories, coupons, and CMS hero slides.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSeedDatabase}
            disabled={isSeeding || !isConnected}
            className="w-full py-3 px-4 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
          >
            {isSeeding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
            <span>{isSeeding ? 'Populating Collections...' : 'Seed Catalog Data'}</span>
          </button>
        </div>
      </div>

      {/* Collections Document Counts Table */}
      {diagnostics?.collections && diagnostics.collections.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Cluster Collection Metrics</h3>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {diagnostics.collections.length} Collections Active
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {diagnostics.collections.map((col) => (
              <div
                key={col.name}
                className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs"
              >
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-800 capitalize">{col.name}</span>
                  <p className="text-[10px] text-slate-400 font-mono">collection</p>
                </div>
                <span className="font-black font-mono text-sm px-2.5 py-1 bg-white rounded-xl border border-slate-200 text-slate-900">
                  {col.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
