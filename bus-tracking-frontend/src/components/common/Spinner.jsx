// src/components/common/Spinner.jsx
import React from 'react';

const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };

const Spinner = ({ size = 'md', className = '' }) => (
  <div className={`${sizes[size]} animate-spin rounded-full border-2 border-gray-200 border-t-brand-blue ${className}`} />
);

export default Spinner;
