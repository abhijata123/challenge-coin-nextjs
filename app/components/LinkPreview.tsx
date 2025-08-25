import React, { useState, useEffect } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';

interface LinkPreviewProps {
  url: string;
}

export const LinkPreview: React.FC<LinkPreviewProps> = ({ url }) => {
  const [metadata, setMetadata] = useState<{
    title?: string;
    description?: string;
    image?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
        const data = await response.json();
        
        if (data.status === 'success') {
          setMetadata({
            title: data.data.title,
            description: data.data.description,
            image: data.data.image?.url
          });
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Error fetching metadata:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 bg-white/5 rounded-lg mt-2">
        <Loader2 className="animate-spin h-5 w-5 text-blue-400" />
      </div>
    );
  }

  if (error || !metadata) {
    return null;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-2 mb-4 bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition-colors"
    >
      <div className="flex flex-col sm:flex-row">
        {metadata.image && (
          <div className="sm:w-48 h-48 sm:h-auto flex-shrink-0">
            <img
              src={metadata.image}
              alt={metadata.title || 'Link preview'}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="p-4">
          {metadata.title && (
            <h3 className="text-white font-medium mb-2 line-clamp-2">
              {metadata.title}
            </h3>
          )}
          {metadata.description && (
            <p className="text-gray-400 text-sm line-clamp-3">
              {metadata.description}
            </p>
          )}
          <div className="flex items-center gap-1 text-blue-400 text-sm mt-2">
            <ExternalLink size={14} />
            {new URL(url).hostname}
          </div>
        </div>
      </div>
    </a>
  );
};