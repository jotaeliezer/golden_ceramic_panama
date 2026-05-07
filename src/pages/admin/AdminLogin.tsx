import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
  const [email, setEmail] = useState("admin@goldenceramic.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem("adminToken", data.token);
        navigate("/admin");
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ivory">
      <div className="bg-white p-8 shadow-xl max-w-md w-full border-t-4 border-gold">
        <h1 className="font-serif text-3xl text-center mb-8">Admin Access</h1>
        
        {error && <div className="bg-red-100 text-red-700 p-3 text-sm text-center mb-6">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full p-2 border border-gray-300 focus:border-gold outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full p-2 border border-gray-300 focus:border-gold outline-none"
              required
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-charcoal text-white py-3 font-semibold tracking-wider hover:bg-charcoal-light transition-colors"
          >
            LOGIN
          </button>
        </form>
      </div>
    </div>
  );
}
