'use client';

import { useState, useEffect } from 'react';
import MobileNav from '@/components/MobileNav';
import { faqAPI } from '@/lib/api';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
}

export default function FAQPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    loadFAQs();
  }, []);

  const loadFAQs = async () => {
    try {
      const data = await faqAPI.getAll();
      setFaqs(data);
    } catch (err) {
      console.error('Failed to load FAQs:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom right, #3d7a94, #5595b0, #2a5f78)' }}>
      <MobileNav currentPage="faq" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-white mb-2 text-center">❓ FAQ</h1>
        <p className="text-white/70 text-center mb-8">Frequently Asked Questions</p>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
          </div>
        ) : faqs.length === 0 ? (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/10 text-center">
            <p className="text-white/60">No FAQs available yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {faqs.map((faq) => (
              <div
                key={faq.id}
                className="bg-white/10 backdrop-blur rounded-xl border border-white/10 overflow-hidden"
              >
                <button
                  onClick={() => toggle(faq.id)}
                  className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-white/5 transition"
                >
                  <span className="text-white font-semibold pr-4">{faq.question}</span>
                  <span className="text-white/60 text-xl flex-shrink-0">
                    {openId === faq.id ? '−' : '+'}
                  </span>
                </button>
                {openId === faq.id && (
                  <div className="px-6 pb-4 text-white/80 whitespace-pre-wrap border-t border-white/10 pt-3">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
