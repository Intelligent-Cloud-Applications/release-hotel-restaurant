import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow, Pagination } from "flowbite-react";
import { useContext, useState, useEffect } from "react";
import { Context } from "../../Context";

export const PaginatedTable = ({ head, data, itemsPerPage = 7, searchQuery, ...props }) => {
  const { PrimaryColor } = useContext(Context).institutionData;
  const [currentPage, setCurrentPage] = useState(1);
  
  // Filter data based on search query if it's present
  const filteredData = searchQuery
    ? data.filter((item) =>
        item.some((column) => column.toString().toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : data;

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);


  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  return (
    <div>
      <div className="hidden lg:block">
        <Table {...props}>
          <TableHead>
            {head.map((item, i) => (
              <TableHeadCell key={i}>{item}</TableHeadCell>
            ))}
          </TableHead>

          <TableBody>
            {paginatedData.map((array, i) => (
              <TableRow key={i} className="border">
                {array.map((item, index) => (
                  <TableCell key={index} className="bg-white">
                    {item}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile view with a different layout */}
      <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 p-4">
        {paginatedData.map((array, i) => (
          <div
            key={i}
            className="flex flex-col p-6 bg-white rounded-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-2xl"
          >
            {array.reduce((acc, item, index) => {
              if (index % 2 === 0) {
                acc.push([item, array[index + 1]]);
              }
              return acc;
            }, []).map((pair, pairIndex) => (
              <div key={pairIndex} className="mb-4 grid grid-cols-2 gap-2">
                {pair.map((item, subIndex) => (
                  <div key={subIndex}>
                    <strong className="block text-sm font-medium text-gray-700">
                      {head[pairIndex * 2 + subIndex]}
                    </strong>
                    <span className="text-gray-800">{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="my-4 flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            className="flex justify-center"
          />
        </div>
      )}
    </div>
  );
};
