import React from 'react';
import '../App.css'; // Tailwind CSS styles (imported)

const TradingLandingPage = () => {
  return (
    <div className="bg-gray-50 text-gray-900 font-sans min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="flex justify-between items-center p-6 bg-white shadow-md">
        <div className="text-2xl font-semibold text-blue-600">TradeX</div>
        <div className="space-x-6">
          <button className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg hover:cursor-pointer">Login</button>
          <button className="px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg hover:cursor-pointer">Sign Up</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center py-40 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <h1 className="text-5xl font-bold mb-4">Trade Smarter, Trade Faster</h1>
        <p className="text-xl mb-8 max-w-lg mx-auto">Secure, reliable, and lightning-fast trading experience powered by blockchain technology. Start trading now!</p>
        <div className="space-x-4">
          <button className="px-6 py-3 text-lg font-semibold bg-yellow-500 hover:bg-yellow-600 rounded-lg hover:cursor-pointer">Get Started</button>
          <button className="px-6 py-3 text-lg  hover:cursor-pointer font-semibold bg-transparent border-2 border-white hover:bg-white hover:text-gray-900 rounded-lg">Learn More</button>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-6 bg-white text-center">
        <h2 className="text-3xl font-semibold mb-10">Why Choose TradeX?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-gray-100 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Fast Transactions</h3>
            <p className="text-gray-700">Experience real-time trading with minimal delays, powered by blockchain.</p>
          </div>
          <div className="bg-gray-100 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Security First</h3>
            <p className="text-gray-700">Your transactions and data are protected by advanced encryption and decentralized technology.</p>
          </div>
          <div className="bg-gray-100 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Cross-Device Access</h3>
            <p className="text-gray-700">Trade securely on desktop, mobile, or tablet, anytime and anywhere.</p>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 px-6 bg-gray-100 text-center">
        <h2 className="text-3xl font-semibold mb-10">What Our Users Say</h2>
        <div className="space-y-8 max-w-3xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <p className="text-gray-700 mb-4">“TradeX has made my trading experience seamless. I trust their platform for all my transactions!”</p>
            <p className="font-semibold text-gray-900">John D.</p>
            <p className="text-gray-500">Professional Investor</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <p className="text-gray-700 mb-4">“Security and speed are top-notch! I highly recommend TradeX for anyone looking to trade with confidence.”</p>
            <p className="font-semibold text-gray-900">Jane S.</p>
            <p className="text-gray-500">Crypto Enthusiast</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-6 text-center">
        <p>&copy; 2025 TradeX. All rights reserved.</p>
        <div className="space-x-4 mt-4">
          <a href="#" className="text-gray-400 hover:text-white">Privacy Policy</a>
          <a href="#" className="text-gray-400 hover:text-white">Terms of Service</a>
          <a href="#" className="text-gray-400 hover:text-white">Help</a>
        </div>
      </footer>
    </div>
  );
};

export default TradingLandingPage;
