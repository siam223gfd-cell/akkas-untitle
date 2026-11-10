import React, { useState, useEffect } from 'react';
import { ContentPage } from '../../types';
import { FileText, Plus, Edit2, Save } from 'lucide-react';
import { AdminModal } from './common/modal';
import { apiRequest } from '../../services/api';
import { useAppDispatch } from '../../app/hooks';
import { addToast } from '../../features/ui/uiSlice';

export const PagesManager: React.FC = () => {
  const dispatch = useAppDispatch();
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [editingPage, setEditingPage] = useState<ContentPage | null>(null);

  const fetchPages = () => {
    apiRequest('/admin/pages').then((res) => {
      if (res.success && res.pages) {
        setPages(res.pages);
      }
    });
  };

  useEffect(() => {
    fetchPages();
  }, []);

  const handleSavePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPage) return;

    const res = await apiRequest(`/admin/pages/${editingPage._id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: editingPage.title,
        content: editingPage.content,
      }),
    });

    if (res.success) {
      setEditingPage(null);
      fetchPages();
      dispatch(
        addToast({
          type: 'success',
          title: 'Page Updated',
          message: `${editingPage.title} content has been published.`,
        })
      );
    } else {
      dispatch(addToast({ type: 'error', title: 'Save Failed', message: res.message || 'Could not update page.' }));
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-black text-slate-900">Website Pages & Policy Content</h2>
          <p className="text-xs text-slate-500">Edit legal, about us, warranty, and customer terms content.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pages.map((p) => (
          <div key={p._id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-blue-600 font-bold uppercase">/{p.slug}</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                  Published
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 mt-1">{p.title}</h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-3">{p.content}</p>
            </div>

            <button
              onClick={() => setEditingPage(p)}
              className="w-full py-2 bg-white hover:bg-blue-50 border border-slate-200 text-blue-600 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Page Content</span>
            </button>
          </div>
        ))}
      </div>

      {editingPage && (
        <AdminModal
          isOpen={!!editingPage}
          onClose={() => setEditingPage(null)}
          icon={<FileText className="w-5 h-5" />}
          title={`Edit Page: ${editingPage.title}`}
          subtitle={`Route: /${editingPage.slug}`}
          size="xl"
        >
          <form onSubmit={handleSavePage} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Page Title</label>
              <input
                type="text"
                required
                value={editingPage.title}
                onChange={(e) => setEditingPage({ ...editingPage, title: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">HTML / Markdown Content</label>
              <textarea
                required
                rows={10}
                value={editingPage.content}
                onChange={(e) => setEditingPage({ ...editingPage, content: e.target.value })}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingPage(null)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer"
              >
                Publish Changes
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
};
