import React from 'react';
import { AuditLog } from '../../../types';
import { AdminDrawer } from '../common/modal';
import { ShieldCheck, Clock, User, Globe, FileCode, CheckCircle2 } from 'lucide-react';

interface AuditLogDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  log: AuditLog | null;
}

export const AuditLogDetailsDrawer: React.FC<AuditLogDetailsDrawerProps> = ({
  isOpen,
  onClose,
  log,
}) => {
  if (!log) return null;

  const formattedDate = new Date(log.timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <AdminDrawer
      isOpen={isOpen}
      onClose={onClose}
      width="lg"
      icon={<ShieldCheck className="w-5 h-5" />}
      title="Audit Trail Record"
      subtitle={`Logged at ${formattedDate}`}
      badge={
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 text-blue-800">
          {log.action}
        </span>
      }
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Close Inspector
        </button>
      }
    >
      {/* 1. Event Meta */}
      <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Actor / User</span>
            <span className="font-bold text-slate-900">{log.actorEmail || log.actorName || 'System Process'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Assigned Role</span>
            <span className="font-bold text-blue-700 uppercase text-[11px]">{(log.actorRole || 'Automated').replace('_', ' ')}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Target Entity / Module</span>
            <span className="font-mono text-slate-900">{log.module || 'General'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Event ID</span>
            <span className="font-mono text-slate-600">{log._id ? log._id.slice(-8) : 'sys'}</span>
          </div>
        </div>
      </div>

      {/* 2. Structured Details */}
      <div className="space-y-2 text-xs">
        <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <FileCode className="w-3.5 h-3.5 text-blue-600" />
          <span>Raw Event Payload & Metadata</span>
        </h4>
        <pre className="p-4 rounded-2xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto leading-relaxed max-h-80 border border-slate-800">
          {JSON.stringify(log.details || log, null, 2)}
        </pre>
      </div>
    </AdminDrawer>
  );
};
