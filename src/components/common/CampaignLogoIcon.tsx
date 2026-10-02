import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const BallotBrainIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <svg 
    viewBox="0 0 32 32" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.8" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    {/* Ballot Paper inserted into top slot */}
    <path d="M12 3L21 8L16 11L7 6Z" fill="currentColor" fillOpacity="0.2" />
    <path d="M12 3L21 8L16 11L7 6Z" />
    <path d="M16 11V7" />

    {/* Top Box Lid & Slot */}
    <path d="M5 11L12 8L27 8L20 11Z" />
    <line x1="11" y1="9.5" x2="21" y2="9.5" strokeWidth="1.5" />

    {/* Box Body */}
    <path d="M5 11V25C5 26.1 5.9 27 7 27H20C21.1 27 22 26.1 22 25V11" />
    <path d="M20 11L27 8V22L20 25" />

    {/* Brain / Leaf Circle Seal in Front Panel */}
    <circle cx="13.5" cy="19" r="4.5" strokeWidth="1.2" fill="currentColor" fillOpacity="0.15" />
    <path d="M12 16.5C11 17 10.5 18 11 19C11.5 20 12.5 20.5 13.5 20.5" strokeWidth="1.2" />
    <path d="M13.5 17.5C12.5 17.5 12 18.5 12.5 19.5" strokeWidth="1" />
    <path d="M15 16.5C16 17 16.5 18 16 19C15.5 20 14.5 20.5 13.5 20.5" strokeWidth="1.2" />
    <path d="M13.5 17.5C14.5 17.5 15 18.5 14.5 19.5" strokeWidth="1" />
    <line x1="13.5" y1="16" x2="13.5" y2="22.5" strokeWidth="1.2" />
  </svg>
);

export const CampaignLogoBadge: React.FC<LogoProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 rounded-xl p-1.5',
    md: 'w-10 h-10 rounded-2xl p-2',
    lg: 'w-14 h-14 rounded-2xl p-3',
    xl: 'w-20 h-20 rounded-3xl p-4'
  };

  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  return (
    <div 
      className={`relative inline-flex shrink-0 items-center justify-center bg-[#022c22]/90 border-2 border-[#00d2a0] text-[#00e6b0] shadow-md shadow-[#00d2a0]/25 transition-transform hover:scale-105 duration-200 ${sizeClasses[size]} ${className}`}
    >
      <BallotBrainIcon className={iconSizes[size]} />
    </div>
  );
};
