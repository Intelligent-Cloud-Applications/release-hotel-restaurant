import React,{useState,useEffect,useRef} from 'react';
const CategoryList = ({ categories, selectedCategory, setSelectedCategory }) => {
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);
    return (
    <>
      {screenWidth > 1025 ? (
      <div className="w-1/4 sm:w-1/5 bg-gray-50 px-2 sm:p-4 border-r h-[calc(90vh-180px)] sm:h-[calc(90vh-240px)]">
        <h2 className="font-bold text-base sm:text-lg mb-2 sm:mb-4">Categories</h2>
        <div className="overflow-y-auto h-[25rem] ">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`block w-full text-left px-2 sm:px-3 py-1 sm:py-2 mb-1 sm:mb-2 rounded-lg transition-all text-xs sm:text-sm ${
                selectedCategory === category
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-200"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
      ):(<>
      </>)
}
    </>
    );
  };

export default CategoryList;