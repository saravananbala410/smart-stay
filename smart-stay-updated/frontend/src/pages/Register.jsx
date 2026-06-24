import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function Register() {
  // ✅ Backend 'HostelRegister' schema-ku yetha maadhiri 'name' nu mathiyacha
  const [form, setForm] = useState({ 
    name: '',         
    owner_name: '', 
    email: '', 
    password: '' 
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // ✅ Main.py-la prefix '/auth' nu irundha dhaan idhu work aagum
      await api.post('/auth/register', form);
      toast.success('Registered Successfully!');
      navigate('/login');
    } catch (err) {
      console.log("Error details:", err.response?.data);
      const msg = err.response?.data?.detail;
      toast.error(Array.isArray(msg) ? "Validation Error: Check your inputs" : (typeof msg === 'string' ? msg : "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-blue-600 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">Smart-Stay Register</h2>
        <form onSubmit={submit} className="space-y-4">
          <input 
            type="text" placeholder="Hostel Name" required 
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            value={form.name} 
            onChange={e => setForm({...form, name: e.target.value})} 
          />
          
          <input 
            type="text" placeholder="Owner Name" required 
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            value={form.owner_name} 
            onChange={e => setForm({...form, owner_name: e.target.value})} 
          />
          
          <input 
            type="email" placeholder="Email" required 
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            value={form.email} 
            onChange={e => setForm({...form, email: e.target.value})} 
          />
          
          <input 
            type="password" placeholder="Password" required 
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            value={form.password} 
            onChange={e => setForm({...form, password: e.target.value})} 
          />
          
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition-all">
            {loading ? 'Creating Account...' : 'Register Hostel'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account? <Link to="/login" className="text-blue-600 font-bold hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
}