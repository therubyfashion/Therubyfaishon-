import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus, HelpCircle, Truck, RefreshCw, CreditCard, ShieldCheck, MessageCircle } from 'lucide-react';
import Navbar from '../components/Navbar';

interface FAQItemProps {
  question: string;
  answer: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onClick: () => void;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer, icon, isOpen, onClick }) => {
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={onClick}
        className="w-full py-6 flex items-center justify-between text-left group transition-all"
      >
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg transition-colors ${isOpen ? 'bg-ruby text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100'}`}>
            {icon}
          </div>
          <span className={`font-semibold text-lg transition-colors ${isOpen ? 'text-ruby' : 'text-[#1A2C54]'}`}>
            {question}
          </span>
        </div>
        <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          {isOpen ? (
            <Minus size={20} className="text-ruby" />
          ) : (
            <Plus size={20} className="text-gray-400" />
          )}
        </div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pb-6 pl-14 pr-4">
              <p className="text-gray-500 leading-relaxed">
                {answer}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqData = [
    {
      category: "Shipping & Delivery",
      items: [
        {
          question: "How can I track my order?",
          answer: "Once your order is shipped, you will receive an email and SMS with a tracking link. You can also track your order directly from the 'My Orders' section in your profile dashboard.",
          icon: <Truck size={20} />
        },
        {
          question: "What are the delivery charges?",
          answer: "We offer free standard delivery on all orders above ₹999. For orders below this amount, a flat shipping fee of ₹49 is applicable across India.",
          icon: <Truck size={20} />
        },
        {
          question: "How long will it take to receive my order?",
          answer: "Standard delivery usually takes 3-5 business days for metro cities and 5-7 business days for other locations. Premium members enjoy 1-2 day express delivery.",
          icon: <Truck size={20} />
        }
      ]
    },
    {
      category: "Returns & Exchanges",
      items: [
        {
          question: "What is your return policy?",
          answer: "We offer a hassle-free 7-day return policy. Items must be unworn, unwashed, and have all original tags attached. Returns are processed within 48 hours of receiving the product back.",
          icon: <RefreshCw size={20} />
        },
        {
          question: "How do I initiate an exchange?",
          answer: "To exchange an item for a different size, go to 'My Orders', select the item, and click on 'Exchange'. We will arrange a reverse pickup and ship the new size once the original item is picked up.",
          icon: <RefreshCw size={20} />
        }
      ]
    },
    {
      category: "Payments & Security",
      items: [
        {
          question: "What payment methods do you accept?",
          answer: "We accept all major Credit/Debit cards, UPI (Google Pay, PhonePe, Paytm), Net Banking, and Cash on Delivery (COD) for most pin codes.",
          icon: <CreditCard size={20} />
        },
        {
          question: "Is it safe to use my card on your website?",
          answer: "Absolutely. We use industry-standard 256-bit SSL encryption to protect your data. We do not store your card details; all transactions are processed through secure, PCI-DSS compliant payment gateways.",
          icon: <ShieldCheck size={20} />
        }
      ]
    },
    {
      category: "Account & Support",
      items: [
        {
          question: "How can I contact customer support?",
          answer: "You can reach us via the live chat widget on our website, email us at support@therubyfashion.shop, or call our toll-free number 1800-RUBY-CARE between 10 AM to 7 PM.",
          icon: <MessageCircle size={20} />
        }
      ]
    }
  ];

  let globalIndex = 0;

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />
      
      {/* Hero Section */}
      <div className="bg-[#1A2C54] py-20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-ruby rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-ruby rounded-full blur-[120px]" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-ruby/20 text-ruby px-4 py-2 rounded-full text-sm font-bold mb-6"
          >
            <HelpCircle size={16} />
            <span>Help Center</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-serif font-bold text-white mb-6"
          >
            How can we <span className="text-ruby italic">help you?</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-gray-300 max-w-2xl mx-auto text-lg"
          >
            Find answers to common questions about orders, shipping, returns, and more.
          </motion.p>
        </div>
      </div>

      {/* FAQ Content */}
      <div className="max-w-4xl mx-auto px-4 py-20">
        <div className="space-y-12">
          {faqData.map((section, sIdx) => (
            <div key={sIdx} className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] border border-gray-50">
              <h2 className="text-2xl font-serif font-bold text-[#1A2C54] mb-8 flex items-center gap-3">
                <span className="w-1.5 h-8 bg-ruby rounded-full"></span>
                {section.category}
              </h2>
              <div className="divide-y divide-gray-50">
                {section.items.map((item, iIdx) => {
                  const currentIndex = globalIndex++;
                  return (
                    <FAQItem
                      key={iIdx}
                      {...item}
                      isOpen={openIndex === currentIndex}
                      onClick={() => setOpenIndex(openIndex === currentIndex ? null : currentIndex)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Still Have Questions? */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mt-20 bg-ruby p-12 rounded-[3rem] text-center text-white relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
          <div className="relative z-10">
            <h3 className="text-3xl font-serif font-bold mb-4 text-white">Still have questions?</h3>
            <p className="text-ruby-50 mb-8 max-w-md mx-auto">
              Can't find the answer you're looking for? Please chat to our friendly team.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="/contact"
                className="bg-white text-ruby px-8 py-4 rounded-2xl font-bold hover:bg-gray-50 transition-all transform hover:scale-105"
              >
                Contact Us
              </a>
              <button
                onClick={() => (window as any).ChatWidget?.toggle()}
                className="bg-[#1A2C54] text-white px-8 py-4 rounded-2xl font-bold hover:bg-[#1A2C54]/90 transition-all transform hover:scale-105"
              >
                Live Chat
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default FAQ;
