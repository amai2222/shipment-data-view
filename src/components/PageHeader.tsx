import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor?: string;
  children?: React.ReactNode;
}

export function PageHeader({ 
  title, 
  description, 
  icon: Icon, 
  iconColor = "text-blue-600",
  children 
}: PageHeaderProps) {
  return (
    <header className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 shadow-sm sticky top-4 z-10">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
            <Icon className={`mr-3 h-7 w-7 ${iconColor}`} />
            {title}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
        </div>
        {children && (
          <div className="flex flex-wrap items-center gap-4">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
