import React from 'react';
import { Mail, Phone, MapPin, Send } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function Contact() {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Message sent! We'll get back to you shortly.");
    (e.target as HTMLFormElement).reset();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-24">
        {/* Contact Info */}
        <div className="space-y-12">
          <div className="space-y-4">
            <h1 className="text-5xl font-serif font-bold tracking-tight">Get in <span className="text-ruby italic">Touch</span></h1>
            <p className="text-gray-500 text-lg font-light tracking-wide max-w-md">
              Have a question about our collection or an order? We're here to help you.
            </p>
          </div>

          <div className="space-y-8">
            <div className="flex items-start space-x-6">
              <div className="w-12 h-12 bg-ruby/10 text-ruby rounded-full flex items-center justify-center flex-shrink-0">
                <Mail size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-widest">Email Us</h4>
                <p className="text-gray-500 text-sm">hello@theruby.com</p>
                <p className="text-gray-500 text-sm">support@theruby.com</p>
              </div>
            </div>

            <div className="flex items-start space-x-6">
              <div className="w-12 h-12 bg-ruby/10 text-ruby rounded-full flex items-center justify-center flex-shrink-0">
                <Phone size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-widest">Call Us</h4>
                <p className="text-gray-500 text-sm">+1 (555) 123-4567</p>
                <p className="text-gray-400 text-xs italic">Mon - Fri, 9am - 6pm EST</p>
              </div>
            </div>

            <div className="flex items-start space-x-6">
              <div className="w-12 h-12 bg-ruby/10 text-ruby rounded-full flex items-center justify-center flex-shrink-0">
                <MapPin size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-widest">Visit Us</h4>
                <p className="text-gray-500 text-sm">123 Fashion Avenue, Suite 456</p>
                <p className="text-gray-500 text-sm">New York, NY 10001, USA</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-gray-50 p-12 space-y-10"
        >
          <h3 className="text-2xl font-serif font-bold">Send a Message</h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">First Name</label>
                <input 
                  type="text" 
                  required
                  className="w-full border-b border-gray-200 bg-transparent py-3 text-sm focus:outline-none focus:border-ruby transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Last Name</label>
                <input 
                  type="text" 
                  required
                  className="w-full border-b border-gray-200 bg-transparent py-3 text-sm focus:outline-none focus:border-ruby transition-colors"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Email Address</label>
              <input 
                type="email" 
                required
                className="w-full border-b border-gray-200 bg-transparent py-3 text-sm focus:outline-none focus:border-ruby transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Subject</label>
              <select className="w-full border-b border-gray-200 bg-transparent py-3 text-sm focus:outline-none focus:border-ruby transition-colors">
                <option>General Inquiry</option>
                <option>Order Support</option>
                <option>Wholesale</option>
                <option>Press</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Message</label>
              <textarea 
                required
                rows={4}
                className="w-full border border-gray-200 bg-transparent p-4 text-sm focus:outline-none focus:border-ruby transition-colors"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-black text-white py-5 text-sm font-bold uppercase tracking-widest hover:bg-ruby transition-all flex items-center justify-center group"
            >
              Send Message
              <Send size={16} className="ml-3 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
