'use client';

import { useEffect, useState } from 'react';

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const saved = localStorage.getItem('plant-theme');
    if (saved === 'dark') {
      document.body.classList.remove('light-mode');
      document.body.classList.add('dark-mode');
      setTheme('dark');
    } else {
      document.body.classList.remove('dark-mode');
      document.body.classList.add('light-mode');
      setTheme('light');
    }
  }, []);

  const toggleTheme = () => {
    const isDark = document.body.classList.contains('dark-mode');
    if (isDark) {
      document.body.classList.remove('dark-mode');
      document.body.classList.add('light-mode');
      localStorage.setItem('plant-theme', 'light');
      setTheme('light');
    } else {
      document.body.classList.remove('light-mode');
      document.body.classList.add('dark-mode');
      localStorage.setItem('plant-theme', 'dark');
      setTheme('dark');
    }
  };

  return (
    <div data-theme-provider>
      <span id="theme-ctx" data-theme={theme} style={{ display: 'none' }} onClick={toggleTheme}></span>
      {children}
    </div>
  );
}
