import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './index.css';

export default function PasswordInput({ value, onChange, placeholder = '请输入密码', ...props }) {
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    onChange && onChange(e.target.value);
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="password-input-container">
      <input
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="password-input"
        {...props}
      />
      <button
        type="button"
        onClick={toggleShowPassword}
        className="password-toggle-btn"
        aria-label={showPassword ? "隐藏密码" : "显示密码"}
      >
        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
