import React from 'react';
import { Rotate3D, Star } from 'lucide-react';
import { NewCoinBadge } from './NewCoinBadge';

interface CoinDisplayProps {
  coin: {
    id: number;
    'Coin Name': string;
    'Coin Image': string;
    'BacksideUrl': string | null;
    'Date Issued': string;
    Featured: boolean;
    created_at: string;
    'Has Copyright'?: boolean;
    Username?: string;
  };
  isFlipped: boolean;
  onFlip: () => void;
  showControls?: boolean;
  className?: string;
}

export const CoinDisplay: React.FC<CoinDisplayProps> = ({
  coin,
  isFlipped,
  onFlip,
  showControls = true,
  className = ''
}) => {
  // Prevent right-click and other ways to save the image
  const preventSave = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  return (
    <div className={`relative ${className}`}>
      <NewCoinBadge dateAdded={coin.created_at} />
      
      <div 
        className="relative aspect-square"
        onContextMenu={preventSave}
      >
        <img
          src={isFlipped && coin.BacksideUrl ? coin.BacksideUrl : coin['Coin Image']}
          alt={coin['Coin Name']}
          className="absolute inset-0 w-full h-full object-contain p-4 select-none"
          width="300"
          height="300"
          loading="lazy"
          draggable="false"
          style={{
            WebkitUserSelect: 'none',
            userSelect: 'none',
            pointerEvents: 'none'
          }}
        />
        
        {/* Copyright tag if enabled */}
        {coin['Has Copyright'] && coin.Username && (
          <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
            Made by {coin.Username}
          </div>
        )}
      </div>
      
      {coin.Featured && (
        <div className="absolute top-2 right-2">
          <Star className="h-6 w-6 text-yellow-500 fill-current" />
        </div>
      )}
      
      {showControls && coin.BacksideUrl && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFlip();
          }}
          className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full flex items-center gap-1 hover:bg-black/70 text-sm"
        >
          <Rotate3D size={14} />
          {isFlipped ? 'Show Front' : 'Flip Coin'}
        </button>
      )}
    </div>
  );
};