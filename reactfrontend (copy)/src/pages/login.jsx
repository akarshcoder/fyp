import React, { useContext, useState } from 'react';
import axios from 'axios';
import '../App.css';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useContext(AuthContext); // Get login function from context
  const navigate = useNavigate(); // Use navigate instead of window.location

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    const endpoint = isLogin ? 'http://localhost:8080/api/auth/login' : 'http://localhost:8080/api/auth/register';
    const payload = { email, password };
  
    try {
      const response = await axios.post(endpoint, payload);
  
      // Handle successful response
      alert(`${isLogin ? 'Login successful!' : 'Account created successfully!'}`);
      console.log('Token:', response.data.token);
  
      // Call the login function from AuthContext
      login(response.data.user, response.data.token); // Pass userData and token
  
      // Save token and redirect
      localStorage.setItem('token', response.data.token); // Use 'token' as the key
      navigate('/home');
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Authentication failed. Please try again.';
      alert(errorMsg);
      console.error('Error:', errorMsg);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Section */}
      <div className="w-1/2 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-12 flex flex-col justify-center">
        <h1 className="text-5xl font-semibold mb-6">Welcome to TradeX</h1>
        <p className="text-xl mb-8">
          Experience fast, secure, and real-time trading with blockchain technology. Start now!
        </p>
        <button className="px-6 py-3 text-lg font-semibold bg-yellow-500 hover:bg-yellow-600 rounded-lg">
          Learn More
        </button>
      </div>

      {/* Right Section */}
      <div className="w-1/2 flex justify-center items-center bg-white p-12">
        <div className="w-full max-w-md bg-white shadow-xl rounded-lg p-8">
          <h2 className="text-3xl font-bold text-center text-blue-600 mb-8">
            {isLogin ? 'Login to Your Account' : 'Create Your Account'}
          </h2>

          <form onSubmit={handleSubmit}>
            {/* Email Input */}
            <div className="mb-6">
              <label htmlFor="email" className="block text-lg font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                id="email"
                className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password Input */}
            <div className="mb-6">
              <label htmlFor="password" className="block text-lg font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                id="password"
                className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3 text-lg font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 mb-6"
            >
              {isLogin ? 'Login' : 'Sign Up'}
            </button>
          </form>

          <div className="text-center">
            <p className="text-gray-600">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <span
                onClick={() => setIsLogin(!isLogin)}
                className="text-blue-600 cursor-pointer hover:underline"
              >
                {isLogin ? 'Sign Up' : 'Login'}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
