'use client';

import { useEffect, useState } from 'react';
import { blogAPI, type BlogPost } from '@/lib/api';
import ImageUpload from './ImageUpload';

interface BlogTabProps {
  setMessage: (msg: string) => void;
  setError: (msg: string) => void;
}

interface FormState {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  isPublished: boolean;
}

const emptyForm: FormState = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  coverImage: null,
  isPublished: true,
};

export default function BlogTab({ setMessage, setError }: BlogTabProps) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await blogAPI.listAdmin();
      setPosts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingPost(null);
    setShowForm(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      await blogAPI.create({
        title: form.title,
        content: form.content,
        excerpt: form.excerpt || undefined,
        coverImage: form.coverImage,
        isPublished: form.isPublished,
        slug: form.slug || undefined,
      });
      setMessage('Post created successfully!');
      resetForm();
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to create post');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost) return;
    try {
      setError('');
      await blogAPI.update(editingPost.id, {
        title: form.title,
        content: form.content,
        excerpt: form.excerpt,
        coverImage: form.coverImage,
        isPublished: form.isPublished,
        slug: form.slug,
      });
      setMessage('Post updated successfully!');
      resetForm();
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to update post');
    }
  };

  const startEdit = (post: BlogPost) => {
    setEditingPost(post);
    setShowForm(false);
    setForm({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || '',
      content: post.content,
      coverImage: post.coverImage,
      isPublished: post.isPublished,
    });
  };

  const handleTogglePublished = async (post: BlogPost) => {
    try {
      setError('');
      await blogAPI.update(post.id, { isPublished: !post.isPublished });
      setMessage(`Post ${post.isPublished ? 'hidden' : 'published'}.`);
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to update post');
    }
  };

  const handleDelete = async (post: BlogPost) => {
    if (!confirm(`Delete post "${post.title}"? This cannot be undone.`)) return;
    try {
      setError('');
      await blogAPI.delete(post.id);
      setMessage('Post deleted.');
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to delete post');
    }
  };

  const renderFormFields = () => (
    <>
      <div>
        <label className="block text-gray-400 mb-1">Title *</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
          placeholder="e.g., Welcome to the Spring Season"
        />
      </div>
      <div>
        <label className="block text-gray-400 mb-1">
          Slug <span className="text-gray-500 text-sm">(URL — auto-generated from title if blank)</span>
        </label>
        <input
          type="text"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
          className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white font-mono text-sm"
          placeholder="welcome-to-the-spring-season"
        />
      </div>
      <div>
        <label className="block text-gray-400 mb-1">
          Excerpt <span className="text-gray-500 text-sm">(short preview shown on home card)</span>
        </label>
        <textarea
          value={form.excerpt}
          onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
          className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
          rows={2}
          placeholder="One or two sentences that show on the home page card."
        />
      </div>
      <div>
        <ImageUpload
          label="Cover Image"
          currentImage={form.coverImage}
          onImageChange={(url) => setForm({ ...form, coverImage: url })}
        />
      </div>
      <div>
        <label className="block text-gray-400 mb-1">Content *</label>
        <textarea
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          required
          className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white font-mono text-sm"
          rows={12}
          placeholder="Write the post body. Plain text or simple Markdown."
        />
      </div>
      <label className="flex items-center gap-2 text-gray-300">
        <input
          type="checkbox"
          checked={form.isPublished}
          onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
          className="w-4 h-4"
        />
        Published (visible on the public site)
      </label>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">📝 Blog Posts</h2>
          <button
            onClick={() => {
              if (editingPost) {
                resetForm();
              } else {
                setShowForm(!showForm);
                setEditingPost(null);
                setForm(emptyForm);
              }
            }}
            className={`px-4 py-2 rounded text-sm font-semibold ${
              showForm || editingPost ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {showForm || editingPost ? '✕ Cancel' : '➕ New Post'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="space-y-4 bg-gray-700/50 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-semibold text-blue-400">New Post</h3>
            {renderFormFields()}
            <button
              type="submit"
              disabled={!form.title.trim() || !form.content.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded font-semibold"
            >
              ➕ Create Post
            </button>
          </form>
        )}

        {editingPost && (
          <form onSubmit={handleUpdate} className="space-y-4 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-semibold text-blue-400">✏️ Editing Post</h3>
            {renderFormFields()}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-2 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!form.title.trim() || !form.content.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-2 rounded font-semibold"
              >
                💾 Save Changes
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
          </div>
        ) : posts.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No posts yet. Click "New Post" to create one!</p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className={`bg-gray-700 p-4 rounded border-l-4 ${
                  post.isPublished ? 'border-blue-500' : 'border-gray-500 opacity-60'
                }`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {!post.isPublished && (
                        <span className="text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded">Hidden</span>
                      )}
                      <span className="text-xs text-gray-500 font-mono">/{post.slug}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(post.publishedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-semibold text-white text-lg">{post.title}</h3>
                    {post.excerpt && (
                      <p className="text-gray-400 text-sm mt-1">{post.excerpt}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEdit(post)}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleTogglePublished(post)}
                      className={`text-sm ${
                        post.isPublished
                          ? 'text-yellow-400 hover:text-yellow-300'
                          : 'text-blue-300 hover:text-blue-200'
                      }`}
                    >
                      {post.isPublished ? '👁️ Hide' : '👁️ Publish'}
                    </button>
                    <button
                      onClick={() => handleDelete(post)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
