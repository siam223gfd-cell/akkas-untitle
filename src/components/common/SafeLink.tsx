import React from 'react';
import { Link } from 'react-router-dom';

interface SafeLinkProps {
  to?: string;
  href?: string;
  target?: '_self' | '_blank';
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
  title?: string;
}

/**
 * Validates and sanitizes destination URLs to prevent unsafe schemes
 */
export function sanitizeUrl(url?: string): { isSafe: boolean; isExternal: boolean; cleanUrl: string } {
  if (!url || typeof url !== 'string') {
    return { isSafe: false, isExternal: false, cleanUrl: '' };
  }

  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  // Block malicious protocols
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return { isSafe: false, isExternal: false, cleanUrl: '#' };
  }

  // Check if external (http, https, //)
  const isExternal =
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('//') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:');

  return { isSafe: true, isExternal, cleanUrl: trimmed };
}

export const SafeLink: React.FC<SafeLinkProps> = ({
  to,
  href,
  target = '_self',
  className = '',
  style,
  onClick,
  children,
  title,
}) => {
  const targetUrl = to || href || '';
  const { isSafe, isExternal, cleanUrl } = sanitizeUrl(targetUrl);

  if (!isSafe || !cleanUrl || cleanUrl === '#') {
    return (
      <span className={className} style={style} title={title}>
        {children}
      </span>
    );
  }

  if (isExternal || target === '_blank') {
    return (
      <a
        href={cleanUrl}
        target={target}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        className={className}
        style={style}
        onClick={onClick}
        title={title}
      >
        {children}
      </a>
    );
  }

  // Internal routing
  return (
    <Link to={cleanUrl} className={className} style={style} onClick={onClick} title={title}>
      {children}
    </Link>
  );
};
