import { Theme } from '../store/themeStore';

export const getBackgroundImage = (theme: Theme): string => {
  switch (theme) {
    case 'us-flag':
      return 'https://images.unsplash.com/photo-1499200493734-6ba25a83f77c';
    case 'army':
      return 'https://images.unsplash.com/photo-1596144086603-679a540a2b28';
    case 'navy':
      return 'https://images.unsplash.com/photo-1581346700233-9f80d2f23449';
    case 'airforce':
      return 'https://images.unsplash.com/photo-1614121174144-bd53a169780e';
    case 'police':
      return 'https://images.unsplash.com/photo-1485056616736-b0840bdf4732';
    case 'firefighting':
      return 'https://images.unsplash.com/photo-1614338577197-5812cb856df7';
    default:
      return 'https://images.unsplash.com/photo-1524522173746-f628baad3644';
  }
};