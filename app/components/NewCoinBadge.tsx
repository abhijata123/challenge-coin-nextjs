import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface NewCoinBadgeProps {
  dateAdded: string;
}

export const NewCoinBadge: React.FC<NewCoinBadgeProps> = ({ dateAdded }) => {
  const [isNew, setIsNew] = useState(false);
  
  useEffect(() => {
    const checkIfNew = () => {
      const addedDate = new Date(dateAdded);
      const currentDate = new Date();
      
      // Calculate the difference in milliseconds
      const differenceMs = currentDate.getTime() - addedDate.getTime();
      
      // Convert to days (86400000 = 24 * 60 * 60 * 1000)
      const differenceDays = differenceMs / 86400000;
      
      // Consider new if less than 1 day old
      setIsNew(differenceDays < 1);
    };
    
    checkIfNew();
    
    // Re-check every hour in case the badge needs to disappear
    const interval = setInterval(checkIfNew, 3600000);
    
    return () => clearInterval(interval);
  }, [dateAdded]);
  
  if (!isNew) return null;
  
  return (
    <div className="absolute top-2 left-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1 z-10">
      <Clock size={12} />
      <span>NEW</span>
    </div>
  );
};