import React, { useState } from 'react';
import { useThemeStore } from '../store/themeStore';
import type { Theme } from '../store/themeStore';
import { ChevronDown, ChevronUp } from 'lucide-react';

const themes: { id: Theme; name: string; icon: string }[] = [
  { id: 'default', name: 'Default', icon: '🎖️' },
  { id: 'us-flag', name: 'US Flag', icon: '🇺🇸' },
  { id: 'army', name: 'Army', icon: '⭐' },
  { id: 'navy', name: 'Navy', icon: '⚓' },
  { id: 'airforce', name: 'Air Force', icon: '✈️' },
  { id: 'police', name: 'Police Force', icon: '👮' },
  { id: 'firefighting', name: 'Firefighting', icon: '🚒' },
];

export const ThemeSelector: React.FC = () => {
  const { theme, setTheme } = useThemeStore();
  const [isOpen, setIsOpen] = useState(false);

  const currentTheme = themes.find(t => t.id === theme) || themes[0];

  return (
    <div className="relative mb-8 px-4 sm:px-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full sm:w-auto flex items-center justify-between gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg text-white hover:bg-white/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">{currentTheme.icon}</span>
          <span>{currentTheme.name} Theme</span>
        </div>
        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full sm:w-64 bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-lg py-2 border border-white/10">
          {themes.map(({ id, name, icon }) => (
            <button
              key={id}
              onClick={() => {
                setTheme(id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-4 py-2 transition-colors ${
                theme === id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-white/10'
              }`}
            >
              <span className="text-xl">{icon}</span>
              <span>{name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};