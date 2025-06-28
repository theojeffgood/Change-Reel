'use client';

import React, { createContext, useState, useContext, ReactNode } from 'react';

// Define the shape of the context state
interface AdminUIState {
  // Filters
  changeTypes: string[];
  setChangeTypes: (types: string[]) => void;
  dateRange: { start: Date | null; end: Date | null };
  setDateRange: (range: { start: Date | null; end: Date | null }) => void;

  // Pagination
  currentPage: number;
  setCurrentPage: (page: number) => void;
  itemsPerPage: number;
  setItemsPerPage: (limit: number) => void;
}

// Create the context with a default undefined value
const AdminUIContext = createContext<AdminUIState | undefined>(undefined);

// Define the props for the provider component
interface AdminUIProviderProps {
  children: ReactNode;
}

// Create the provider component
export const AdminUIProvider = ({ children }: AdminUIProviderProps) => {
  const [changeTypes, setChangeTypes] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const value = {
    changeTypes,
    setChangeTypes,
    dateRange,
    setDateRange,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
  };

  return (
    <AdminUIContext.Provider value={value}>
      {children}
    </AdminUIContext.Provider>
  );
};

// Create a custom hook for using the context
export const useAdminUI = () => {
  const context = useContext(AdminUIContext);
  if (context === undefined) {
    throw new Error('useAdminUI must be used within an AdminUIProvider');
  }
  return context;
}; 