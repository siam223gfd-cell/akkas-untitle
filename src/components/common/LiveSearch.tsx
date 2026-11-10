import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, ArrowRight, X, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../services/api';

interface LiveSearchProps {
  placeholder?: string;
  isMobile?: boolean;
  onNavigate?: () => void;
  className?: string;
}

interface SuggestionItem {
  _id: string;
  name: string;
  slug: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  brand: string;
  stock: number;
  inStock: boolean;
  rating?: number;
  badge?: string;
}

export const LiveSearch: React.FC<LiveSearchProps> = ({
  placeholder = 'Search smartphones, noise-cancelling earbuds, ultrabooks...',
  isMobile = false,
  onNavigate,
  className = '',
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRequestIdRef = useRef<number>(0);

  // Debounced search query
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      setIsOpen(false);
      setSelectedIndex(-1);
      return;
    }

    setIsLoading(true);
    setIsOpen(true);
    const requestId = ++activeRequestIdRef.current;

    const timer = setTimeout(async () => {
      try {
        const res = await apiRequest(`/products/suggestions?q=${encodeURIComponent(trimmed)}`);
        // Discard stale responses from out-of-order API requests
        if (requestId !== activeRequestIdRef.current) return;

        setIsLoading(false);
        if (res.success && Array.isArray(res.suggestions)) {
          setSuggestions(res.suggestions);
          setSelectedIndex(-1);
        } else {
          setSuggestions([]);
        }
      } catch {
        if (requestId !== activeRequestIdRef.current) return;
        setIsLoading(false);
        setSuggestions([]);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (slug: string) => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(-1);
    navigate(`/product/${slug}`);
    if (onNavigate) onNavigate();
  };

  const handleFullSearch = (searchQuery: string) => {
    setIsOpen(false);
    setSelectedIndex(-1);
    if (searchQuery.trim()) {
      navigate(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
      if (onNavigate) onNavigate();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
      handleSelect(suggestions[selectedIndex].slug);
    } else if (query.trim()) {
      handleFullSearch(query);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSelectedIndex(-1);
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[selectedIndex].slug);
      }
    }
  };

  // Helper to highlight matching text in query
  const renderHighlightedName = (name: string, search: string) => {
    if (!search || !name) return name;
    const parts = name.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === search.toLowerCase() ? (
        <span key={i} className="text-blue-600 font-black underline decoration-blue-400">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim().length >= 2) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="live-search-suggestions"
          className={`w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all ${
            isMobile ? 'pl-3.5 pr-14 py-2.5 text-xs' : 'pl-4 pr-16 py-2.5 text-xs sm:text-sm'
          }`}
        />

        {/* Clear query button */}
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSuggestions([]);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className={`absolute text-slate-400 hover:text-slate-600 p-1 ${
              isMobile ? 'right-9' : 'right-11'
            }`}
            aria-label="Clear search query"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Submit / Loading Button */}
        <button
          type="submit"
          className={`absolute right-1.5 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer shadow-xs flex items-center justify-center`}
          aria-label="Search"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Search className="w-3.5 h-3.5" />
          )}
        </button>
      </form>

      {/* Autocomplete Suggestions Dropdown */}
      {isOpen && query.trim().length >= 2 && (
        <div
          id="live-search-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-2 z-50 max-h-96 overflow-y-auto"
        >
          {isLoading && suggestions.length === 0 ? (
            <div className="py-6 px-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <span>Searching catalog...</span>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="py-6 px-4 text-center space-y-1">
              <p className="text-xs font-bold text-slate-800">No matching products found</p>
              <p className="text-[11px] text-slate-400">
                No items match <span className="font-semibold text-slate-600">"{query}"</span>. Try checking spelling or searching a broader term.
              </p>
            </div>
          ) : (
            <>
              <div className="px-3.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1 flex items-center justify-between">
                <span>Matching Catalog Results</span>
                <span className="text-[9px] text-slate-400">Use ↑↓ keys to navigate</span>
              </div>

              {suggestions.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={item._id || item.slug}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(item.slug)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`px-3.5 py-2.5 cursor-pointer flex items-center gap-3 transition-colors border-b border-slate-50 last:border-b-0 ${
                      isSelected ? 'bg-blue-50/90' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Product Name, Category & Brand */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {renderHighlightedName(item.name, query.trim())}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs font-black text-blue-700 tabular-nums">
                          ৳{item.price.toLocaleString()}
                        </span>
                        {item.originalPrice && (
                          <span className="text-[10px] text-slate-400 line-through tabular-nums">
                            ৳{item.originalPrice.toLocaleString()}
                          </span>
                        )}
                        <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-medium">
                          {item.category}
                        </span>
                        {item.inStock ? (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                            In Stock
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded">
                            Out of Stock
                          </span>
                        )}
                      </div>
                    </div>

                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 shrink-0" />
                  </div>
                );
              })}

              {/* View all results button */}
              <div className="pt-2 px-3 border-t border-slate-100 mt-1">
                <button
                  type="button"
                  onClick={() => handleFullSearch(query)}
                  className="w-full py-2 bg-slate-50 hover:bg-blue-50 text-blue-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>View all results for "{query}"</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
