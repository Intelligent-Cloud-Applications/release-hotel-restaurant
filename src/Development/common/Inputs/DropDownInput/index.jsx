import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Search } from "lucide-react";

// Simple searchable input component
const SearchableInput = ({
  options = [],
  value = "",
  onChange,
  placeholder = "Search and select...",
  className = "",
  disabled = false,
  getOptionLabel = (option) => option.label || option.name || String(option),
  getOptionValue = (option) => option.value || option.id || option,
  noOptionsText = "No options found",
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const optionsRef = useRef(null);
  const containerRef = useRef(null);

  // Get selected option
  const selectedOption = options.find(
    (option) => getOptionValue(option) === value
  );
  const displayValue = selectedOption
    ? getOptionLabel(selectedOption)
    : searchTerm;

  // Filter options based on search term
  const filteredOptions = options.filter((option) => {
    const label = getOptionLabel(option).toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    return label.includes(searchLower);
  });

  // Handle input change
  const handleInputChange = (e) => {
    const inputValue = e.target.value;
    setSearchTerm(inputValue);
    setShowOptions(true);
    setHighlightedIndex(-1);

    // Clear selection if input doesn't match any option exactly
    if (selectedOption && getOptionLabel(selectedOption) !== inputValue) {
      onChange("");
    }
  };

  // Handle option selection
  const handleOptionSelect = (option) => {
    const optionValue = getOptionValue(option);
    const optionLabel = getOptionLabel(option);

    setSearchTerm(optionLabel);
    setShowOptions(false);
    setHighlightedIndex(-1);
    onChange(optionValue);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showOptions) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setShowOptions(true);
        setHighlightedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        setShowOptions(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;

      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;

      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;

      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleOptionSelect(filteredOptions[highlightedIndex]);
        } else if (filteredOptions.length === 1) {
          handleOptionSelect(filteredOptions[0]);
        }
        break;

      case "Tab":
        setShowOptions(false);
        break;
    }
  };

  // Handle input focus
  const handleFocus = () => {
    setShowOptions(true);
  };

  // Close options when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setShowOptions(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && optionsRef.current) {
      const highlightedElement = optionsRef.current.children[highlightedIndex];
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [highlightedIndex]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        className="border px-3 py-2 rounded w-full text-sm focus:ring-1 focus:ring-primaryColor focus:outline-none"
        placeholder={placeholder}
        value={displayValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        disabled={disabled}
        autoComplete="off"
      />

      {showOptions && filteredOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
          <div ref={optionsRef}>
            {filteredOptions.map((option, index) => {
              const isHighlighted = index === highlightedIndex;
              const isSelected = getOptionValue(option) === value;

              return (
                <div
                  key={getOptionValue(option)}
                  className={`
                    px-3 py-2 text-sm cursor-pointer
                    ${isHighlighted ? "bg-primaryColor text-white" : ""}
                    ${
                      isSelected
                        ? "bg-blue-50 text-primaryColor font-medium"
                        : ""
                    }
                    ${!isHighlighted && !isSelected ? "hover:bg-gray-50" : ""}
                  `}
                  onClick={() => handleOptionSelect(option)}>
                  {getOptionLabel(option)}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Stock-specific input component
const StockInput = ({ stocks = [], value, onChange, filterType, ...props }) => {
  const filteredStocks = stocks.filter(
    (stock) => !filterType || stock.type === filterType
  );

  return (
    <SearchableInput
      options={filteredStocks}
      value={value}
      onChange={onChange}
      getOptionLabel={(stock) => `${stock.stockName} (${stock.quantity})`}
      getOptionValue={(stock) => stock.stockId}
      placeholder="Type to search stocks..."
      noOptionsText="No stocks found"
      {...props}
    />
  );
};

export default SearchableInput;
export { StockInput };
