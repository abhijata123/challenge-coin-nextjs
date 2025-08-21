import React from 'react';
import { Shield, Award } from 'lucide-react';

interface UserBadgesProps {
  isAdmin?: boolean;
  isFoundingMember?: boolean;
  size?: number;
}

export const UserBadges: React.FC<UserBadgesProps> = ({ 
  isAdmin = false, 
  isFoundingMember = false,
  size = 16
}) => {
  if (!isAdmin && !isFoundingMember) return null;

  return (
    <div className="flex gap-1">
      {isAdmin && (
        <div 
          className="bg-red-500/20 text-red-500 p-1 rounded-full" 
          title="Admin"
        >
          <Shield size={size} />
        </div>
      )}
      {isFoundingMember && (
        <div 
          className="bg-yellow-500/20 text-yellow-500 p-1 rounded-full" 
          title="Braav Founding Member"
        >
          <Award size={size} />
        </div>
      )}
    </div>
  );
};