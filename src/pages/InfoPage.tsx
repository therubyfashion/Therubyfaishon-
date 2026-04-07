import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, Sparkles } from 'lucide-react';

const content: Record<string, { title: string; body: string }> = {
  'privacy': {
    title: 'Privacy Policy',
    body: 'Your privacy is important to us. This policy explains how we collect, use, and protect your personal information when you use The Ruby.'
  },
  'terms': {
    title: 'Terms & Conditions',
    body: 'By accessing or using The Ruby, you agree to be bound by these terms and conditions. Please read them carefully.'
  },
  'refund': {
    title: 'Refund Policy',
    body: 'We want you to be completely satisfied with your purchase. If you are not happy, we offer a straightforward refund and exchange process.'
  },
  'shipping': {
    title: 'Shipping & Returns',
    body: 'We offer Pan-India shipping. Most orders are delivered within 5-7 business days. Returns are accepted within 15 days of delivery.'
  },
  'returns': {
    title: 'Returns & Exchanges',
    body: 'Need to return something? No problem. Our return process is simple and hassle-free. Contact our support team to initiate a return.'
  },
  'size-guide': {
    title: 'Size Guide',
    body: 'Find your perfect fit with our comprehensive size guide. We provide detailed measurements for all our garments.'
  },
  'careers': {
    title: 'Careers',
    body: 'Join the team at The Ruby. We are always looking for passionate individuals to help us redefine women\'s fashion.'
  },
  'blog': {
    title: 'The Ruby Blog',
    body: 'Stay updated with the latest fashion trends, styling tips, and behind-the-scenes stories from The Ruby.'
  }
};

export default function InfoPage() {
  const { slug } = useParams<{ slug: string }>();
  const page = slug ? content[slug] : null;

  if (!page) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-serif font-bold mb-4">Page Not Found</h1>
        <Link to="/" className="text-ruby font-bold uppercase tracking-widest text-sm">Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] pt-32 pb-24 px-4">
      <div className="max-w-3xl mx-auto">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 hover:text-ruby transition-colors mb-12"
        >
          <ChevronLeft size={14} />
          Back to Home
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-10 md:p-16 rounded-[3rem] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.08)] border border-gray-50"
        >
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-ruby">
                <Sparkles size={20} />
                <span className="text-[10px] font-bold uppercase tracking-[0.3em]">The Ruby Official</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-[#1A2C54] tracking-tight">
                {page.title}
              </h1>
            </div>

            <div className="h-px bg-gray-100 w-full" />

            <div className="prose prose-ruby max-w-none">
              <p className="text-gray-500 leading-relaxed text-lg font-light">
                {page.body}
              </p>
              <p className="text-gray-500 leading-relaxed text-lg font-light mt-6">
                For more detailed information or specific inquiries regarding our {page.title.toLowerCase()}, please reach out to our customer support team at hello@theruby.com or visit our contact page.
              </p>
            </div>

            <div className="pt-12">
              <Link 
                to="/contact"
                className="inline-block bg-[#1A2C54] text-white px-8 py-4 rounded-2xl text-xs font-bold uppercase tracking-[0.2em] hover:bg-ruby transition-all shadow-xl shadow-[#1A2C54]/10"
              >
                Contact Support
              </Link>
            </div>
          </div>
        </motion.div>

        <p className="mt-12 text-center text-[10px] text-gray-300 uppercase tracking-[0.4em] font-bold">
          The Ruby Premium Experience
        </p>
      </div>
    </div>
  );
}
