import React, { useState, useEffect } from 'react';
import { BlogPost } from '../../types';
import { Newspaper, Plus, Edit2, Calendar, User, Eye, Trash2 } from 'lucide-react';
import { AdminModal, AdminDrawer } from './common/modal';
import { ImageUploadInput } from '../common/ImageUploadInput';
import { apiRequest } from '../../services/api';
import { useAppDispatch } from '../../app/hooks';
import { addToast } from '../../features/ui/uiSlice';

export const BlogPostsManager: React.FC = () => {
  const dispatch = useAppDispatch();
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBlog, setSelectedBlog] = useState<BlogPost | null>(null);

  const [form, setForm] = useState({
    title: '',
    summary: '',
    content: '',
    author: 'Aurelia Editorial',
    image: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=400&q=80',
    tags: 'Tech,Gadgets,Audio',
  });

  const fetchBlogs = () => {
    apiRequest('/admin/blogs').then((res) => {
      if (res.success && res.blogs) {
        setBlogs(res.blogs);
      }
    });
  };

  useEffect(() => {
    fetchBlogs();
  }, []);

  const handleCreateBlog = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      tags: form.tags.split(',').map((t) => t.trim()),
    };
    const res = await apiRequest('/admin/blogs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.success) {
      setIsModalOpen(false);
      setForm({ title: '', summary: '', content: '', author: 'Aurelia Editorial', image: '', tags: 'Tech,Audio' });
      fetchBlogs();
      dispatch(
        addToast({
          type: 'success',
          title: 'Article Published',
          message: `${form.title} is now published.`,
        })
      );
    } else {
      dispatch(addToast({ type: 'error', title: 'Publish Failed', message: res.message || 'Could not publish blog post.' }));
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Newspaper className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">Blog Posts & Store Articles</h2>
            <p className="text-xs text-slate-500">Publish guides, buying recommendations, and store announcements.</p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Article</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {blogs.map((b) => (
          <div key={b._id} className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3 flex flex-col justify-between">
            <div className="flex gap-4">
              {b.image && (
                <img
                  src={b.image}
                  alt={b.title}
                  className="w-24 h-24 object-cover rounded-xl bg-slate-50 shrink-0"
                />
              )}
              <div className="space-y-1 min-w-0">
                <span className="text-[10px] text-blue-600 font-bold uppercase">{b.tags?.join(' · ')}</span>
                <h4 className="text-sm font-bold text-slate-900 line-clamp-2">{b.title}</h4>
                <p className="text-xs text-slate-500 line-clamp-2">{b.summary}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-50 text-[11px] text-slate-400">
              <span>By {b.author}</span>
              <div className="flex items-center gap-2">
                <span>{new Date(b.publishedAt).toLocaleDateString()}</span>
                <button
                  type="button"
                  onClick={() => setSelectedBlog(b)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                  title="Inspect article drawer"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* AdminModal for Creating New Blog Article */}
      <AdminModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        icon={<Newspaper className="w-5 h-5" />}
        title="Publish New Blog Post"
        subtitle="Share technology reviews and lifestyle updates with your shoppers."
        size="2xl"
      >
        <form onSubmit={handleCreateBlog} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Article Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Best Noise-Cancelling Earbuds of 2026"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Short Summary <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              required
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder="Brief summary for listings and SEO..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Article Content <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={7}
              required
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Full article content..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <ImageUploadInput
              label="Featured Article Graphic"
              value={form.image}
              onChange={(url) => setForm({ ...form, image: url })}
              placeholder="https://..."
              helperText="Upload 16:9 editorial hero image or enter URL."
              aspectRatio="video"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Tags (comma-separated)</label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="Tech, Audio, Smart Devices"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer"
            >
              Publish Post
            </button>
          </div>
        </form>
      </AdminModal>

      {/* Blog Inspection Drawer */}
      {selectedBlog && (
        <AdminDrawer
          isOpen={!!selectedBlog}
          onClose={() => setSelectedBlog(null)}
          width="xl"
          icon={<Newspaper className="w-5 h-5" />}
          title={selectedBlog.title}
          subtitle={`By ${selectedBlog.author} · ${new Date(selectedBlog.publishedAt).toLocaleDateString()}`}
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
              Published
            </span>
          }
          footer={
            <button
              type="button"
              onClick={() => setSelectedBlog(null)}
              className="px-5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Close
            </button>
          }
        >
          {selectedBlog.image && (
            <img
              src={selectedBlog.image}
              alt={selectedBlog.title}
              className="w-full h-48 object-cover rounded-2xl border border-slate-200 mb-4"
            />
          )}

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Summary
              </span>
              <p className="text-slate-700 font-medium leading-relaxed mt-0.5">
                {selectedBlog.summary}
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Full Article Text
              </span>
              <p className="text-slate-800 whitespace-pre-line leading-relaxed font-sans">
                {selectedBlog.content}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-2">
              {selectedBlog.tags?.map((t: string) => (
                <span
                  key={t}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-bold"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>
        </AdminDrawer>
      )}
    </div>
  );
};
