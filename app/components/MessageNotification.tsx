import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface MessageNotificationProps {
  sender: {
    name: string;
    avatar?: string;
    uid: string;
  };
  message: string;
  onClose: () => void;
  onClick: () => void;
}

export const MessageNotification: React.FC<MessageNotificationProps> = ({
  sender,
  message,
  onClose,
  onClick
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    
    // Auto-close after 10 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Allow animation to complete
    }, 10000);
    
    return () => clearTimeout(timer);
  }, [onClose]);

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVisible(false);
    setTimeout(onClose, 300); // Allow animation to complete
  };

  return (
    <div 
      className={`fixed top-24 right-4 z-50 transition-all duration-300 ease-in-out transform ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
      onClick={onClick}
    >
      <div className="bg-[#0d182a] border border-white/10 rounded-lg shadow-lg p-4 w-80 backdrop-blur-sm">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-white font-semibold">New Message</h3>
          <button 
            onClick={handleClose}
            className="text-gray-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="flex items-start">
          <img 
            src={sender.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${sender.name || sender.uid}`}
            alt={sender.name || sender.uid}
            className="w-10 h-10 rounded-full mr-3"
          />
          <div>
            <p className="text-white font-medium">{sender.name || sender.uid}</p>
            <p className="text-gray-300 text-sm">{message}</p>
          </div>
        </div>
        
        <div className="mt-3 text-xs text-blue-400 text-right">
          Click to open chat
        </div>
      </div>
    </div>
  );
};