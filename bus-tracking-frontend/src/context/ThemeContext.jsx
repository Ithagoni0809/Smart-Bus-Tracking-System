// src/context/ThemeContext.jsx
// ─────────────────────────────────────────────────────────────
// WHY THIS FILE EXISTS:
//   Manages dark/light mode globally. When `dark` is true, we add
//   the class 'dark' to <html> — Tailwind's `dark:` variants then
//   activate automatically across every component.
//
//   We persist the choice in localStorage so it survives page reloads
//   without flicker (we apply it synchronously before React renders).
// ─────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  // Initialize from localStorage (or system preference if no stored preference)
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Apply/remove the 'dark' class on <html> whenever isDark changes
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
};
