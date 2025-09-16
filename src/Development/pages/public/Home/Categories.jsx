import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../../../Context";
import { getCurrencySymbol } from "../../../common/Inputs";

const Categories = () => {
  const { items } = useContext(Context);
  const [categories, setCategories] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!items || items.length === 0) return;
    const filteredItems = items.filter((item) => !item.outOfStock);
    const groupedCategories = filteredItems.reduce((acc, item) => {
      if (!item.category) return acc;
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {});

    const sortedCategories = Object.entries(groupedCategories).sort(
      (a, b) => b[1].length - a[1].length
    );

    const topCategories = sortedCategories.slice(0, 3);

    let maxItemsToShow = Math.min(
      topCategories[0]?.[1]?.length || 0,
      topCategories[1]?.[1]?.length || 5
    );
    maxItemsToShow = Math.min(maxItemsToShow, 5);

    const selectedCategories = topCategories.map(([key, value]) => ({
      category: key,
      items: value.slice(0, maxItemsToShow),
    }));

    setCategories(selectedCategories);
  }, [items]);

  return (
    <section className="h-auto flex flex-col items-center bg-white p-4
    pb-10 sm:px-10 md:px-16 lg:px-24 font-lora">
      <div className="w-full flex flex-col items-center mt-10 sm:mt-16 px-4 md:px-10 text-center">
        <div className="w-full md:w-[80%] lg:w-[50%] text-primaryColor">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
            Explore Our Menu.
          </h1>
          <p className="text-sm md:text-base lg:text-lg mt-3">
            Discover our top categories and delicious offerings.
          </p>
        </div>
      </div>

      <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-14 justify-center py-8 lg:mt-5">
        {categories.map(({ category, items }) => (
          <div
            key={category}
            className="bg-primaryColor text-white rounded-2xl px-6 py-4 shadow-md"
          >
            <h1 className="text-xl md:text-2xl lg:text-2.5xl py-5 border-b border-white text-left font-[900]">
              {category
                ? category[0].toUpperCase() + category.slice(1)
                : "Unknown Category"}
            </h1>
            {items.map((item) => (
              <div
                key={item.itemId || Math.random()}
                className="py-3 border-b border-white last:border-none"
              >
                <h3 className="font-semibold text-lg">
                  {item.itemName
                    ? item.itemName[0].toUpperCase() + item.itemName.slice(1)
                    : "Unnamed Item"}{" "}
                  <br />
                  {item.price
                    ? `${getCurrencySymbol(item.currency) || ""}${item.price}`
                    : "Price Not Available"}
                </h3>
                {/* <p className="text-sm">A delicious choice from our menu.</p> */}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex justify-center mt-10">
        <button
          className="bg-primaryColor text-white text-lg font-semibold px-8 py-3 rounded-full shadow-lg transition-all duration-300 hover:bg-secondaryColor"
          onClick={() => navigate("/product")}
        >
          Explore More
        </button>
      </div>
    </section>
  );
};

export default Categories;