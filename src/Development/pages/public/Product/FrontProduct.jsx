import React, { useContext, useState } from 'react';
import { Search, Sparkles, Star } from 'lucide-react';
import { Context } from "../../../Context";

const FrontProduct = ({
  productTagline,
  handleSearch,
  handleSearchInputChange,
  searchTerm,
  suggestions,
  setSearchTerm,
  setSuggestions
}) => {
  const { institutionData } = useContext(Context);
  const secondaryColor = institutionData?.secondaryColor || '#FCD34D';
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="relative min-h-[45vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-amber-100 via-white to-amber-200">
      {/* Static gradient background */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 20% 20%, ${secondaryColor}40, transparent 35%),
            radial-gradient(circle at 80% 20%, ${secondaryColor}50, transparent 40%),
            radial-gradient(circle at 50% 50%, ${secondaryColor}40, transparent 45%),
            radial-gradient(circle at 80% 80%, ${secondaryColor}50, transparent 40%),
            radial-gradient(circle at 20% 80%, ${secondaryColor}40, transparent 35%)
          `
        }}
      />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 py-12 text-center">
        {/* Title section */}
        <div className="inline-flex items-center gap-4 mb-4 relative">
          <Star 
            className="w-6 h-6 absolute -left-12 top-0 text-amber-500"
          />
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 tracking-tight">
            Products
          </h1>
          <Sparkles 
            className="w-8 h-8" 
            style={{ color: secondaryColor }}
          />
          <Star 
            className="w-6 h-6 absolute -right-12 top-0 text-amber-500"
          />
        </div>
        {/* Tagline */}
        <p className="text-lg md:text-xl text-gray-700 font-medium mb-10 max-w-3xl mx-auto leading-relaxed">
          {productTagline}
        </p>

        {/* Search section */}
        <div className="w-full max-w-2xl mx-auto relative">
          <form onSubmit={handleSearch} className="relative group">
            <div 
              className="relative transition-all duration-300"
            >
              <input
                type="search"
                className="w-full px-8 py-4 text-lg bg-white rounded-2xl outline-none transition-all duration-300 pr-16 shadow-xl border-2 focus:shadow-2xl placeholder-gray-400"
                style={{
                  borderColor: isFocused ? secondaryColor : 'transparent',
                  boxShadow: isFocused ? `0 8px 32px ${secondaryColor}40` : undefined
                }}
                placeholder="Search for delightful products..."
                onChange={handleSearchInputChange}
                value={searchTerm}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />

              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-3 text-white rounded-xl transition-all duration-300 hover:scale-105"
                style={{
                  backgroundColor: secondaryColor,
                  boxShadow: `0 4px 20px ${secondaryColor}70`
                }}
              >
                <Search className="w-5 h-5" />
              </button>
            </div>

            {/* Suggestions dropdown - Floating above all UI */}
            {/* {suggestions.length > 0 && (
              <div
                className="fixed w-full max-w-2xl left-1/2 transform -translate-x-1/2 mt-4 bg-white rounded-2xl shadow-2xl overflow-hidden border-2 backdrop-blur-sm mx-auto"
                style={{
                  borderColor: `${secondaryColor}30`,
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  zIndex: 9999,
                  top: isFocused ? '50%' : '50%',
                }}
              >
                <ul className="max-h-64 overflow-y-auto">
                  {suggestions.map((suggestion, index) => (
                    <li
                      key={index}
                      onClick={() => {
                        setSearchTerm(suggestion);
                        setSuggestions([]);
                      }}
                      className="px-8 py-3 cursor-pointer text-left text-gray-800 transition-all duration-300 hover:bg-amber-50 flex items-center gap-3 group"
                    >
                      <Search className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                      <span className="group-hover:translate-x-2 transition-transform duration-300">
                        {suggestion}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )} */}
          </form>
        </div>
      </div>

      {/* Grain texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
};

export default FrontProduct;