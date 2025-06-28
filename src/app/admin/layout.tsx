import { AdminUIProvider } from '@/lib/context/AdminUIContext';
import React from 'react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminUIProvider>{children}</AdminUIProvider>;
} 