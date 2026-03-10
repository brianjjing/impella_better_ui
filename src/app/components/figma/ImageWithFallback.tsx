import React from 'react';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
}

export function ImageWithFallback({
  src,
  fallback = 'https://placehold.co/400x300?text=No+Image',
  alt = '',
  ...props
}: ImageWithFallbackProps) {
  const [imgSrc, setImgSrc] = React.useState(src);
  return (
    <img
      {...props}
      src={imgSrc}
      alt={alt}
      onError={() => setImgSrc(fallback)}
    />
  );
}
