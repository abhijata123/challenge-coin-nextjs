import React from 'react';
import { LinkPreview } from '../components/LinkPreview';

export const renderContent = (content: string) => {
  // Extract URLs from content
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = content.match(urlRegex) || [];
  
  // Remove URLs from the content
  const textContent = content.replace(urlRegex, '').trim();
  
  return (
    <>
      {/* Render the text content first */}
      {textContent}
      
      {/* Render all link previews at the end */}
      {urls.map((url, index) => (
        <React.Fragment key={index}>
          <LinkPreview url={url} />
        </React.Fragment>
      ))}
    </>
  );
};