'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import MobileNav from '@/components/MobileNav';
import { blogAPI, type BlogPost } from '@/lib/api';

export default function BlogPostPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    blogAPI
      .getBySlug(slug)
      .then(setPost)
      .catch((err) => setError(err.message || 'Post not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="min-h-screen page-gradient-blog">
      <MobileNav />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/blog" className="text-blue-300 hover:text-blue-200 text-sm mb-6 inline-block">
          ← Back to all posts
        </Link>

        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400 mx-auto"></div>
          </div>
        ) : error || !post ? (
          <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-xl">
            {error || 'Post not found'}
          </div>
        ) : (
          <article className="bg-white/10 backdrop-blur rounded-2xl border border-white/10 overflow-hidden">
            {post.coverImage && (
              <div className="relative w-full h-64 md:h-80">
                <Image src={post.coverImage} alt={post.title} fill className="object-cover" priority />
              </div>
            )}
            <div className="p-6 md:p-10">
              <p className="text-white/50 text-sm mb-2">
                {new Date(post.publishedAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-6">{post.title}</h1>
              <div className="text-white/90 whitespace-pre-wrap leading-relaxed text-lg">
                {post.content}
              </div>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
