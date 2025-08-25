import React from 'react';

export const CoinSkeleton: React.FC = () => {
  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-lg overflow-hidden animate-pulse">
      <div className="relative group">
        <div className="relative w-[200px] h-[200px] mx-auto bg-gray-700"></div>
        <div className="p-4">
          <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    </div>
  );
};