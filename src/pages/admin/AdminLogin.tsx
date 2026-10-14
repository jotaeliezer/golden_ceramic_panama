import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent) => {
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
      <div className="bg-white p-8 shadow-xl max-w-md w-full border-t-4 border-gold dark:bg-neutral-900 dark:text-neutral-100 dark:ring-1 dark:ring-white/10">
        <h1 className="font-serif text-3xl text-center mb-8">Admin Access</h1>
        
        {error && <div className="bg-red-100 text-red-700 p-3 text-sm text-center mb-6 dark:bg-red-950 dark:text-red-200">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 dark:text-neutral-200">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full p-2 border border-gray-300 bg-white text-gray-900 focus:border-gold outline-none dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 dark:text-neutral-200">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full p-2 border border-gray-300 bg-white text-gray-900 focus:border-gold outline-none dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100"
              required
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-ink text-white py-3 font-semibold tracking-wider hover:bg-ink-light transition-colors dark:ring-1 dark:ring-white/40"
          >
            LOGIN
          </button>
        </form>
      </div>
    </div>
  );
}
