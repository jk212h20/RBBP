'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import MobileNav from '@/components/MobileNav';
import { blogAPI, type BlogListItem } from '@/lib/api';

export default function BlogIndexPage() {
  const [posts, setPosts] = useState<BlogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    blogAPI
      .list()
      .then(setPosts)
      .catch((err) => setError(err.message || 'Failed to load posts'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom right, #3d7a94, #5595b0, #2a5f78)' }}>
      <MobileNav />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-8">📝 Blog</h1>

        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400 mx-auto"></div>
          </div>
        ) : error ? (
          <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-xl">
            {error}
          </div>
        ) : posts.length === 0 ? (
          <p className="text-white/70 text-center py-16">No posts yet — check back soon.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="block bg-white/10 backdrop-blur rounded-2xl border border-white/10 overflow-hidden hover:bg-white/15 transition"
              >
                {post.coverImage && (
                  <div className="relative w-full h-48">
                    <Image src={post.coverImage} alt={post.title} fill className="object-cover" />
                  </div>
                )}
                <div className="p-5">
                  <p className="text-white/50 text-xs mb-2">
                    {new Date(post.publishedAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                  <h2 className="text-white font-bold text-xl mb-2">{post.title}</h2>
                  {post.excerpt && <p className="text-white/70 text-sm">{post.excerpt}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
