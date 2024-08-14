
/**
 * Pagination utility function
 * @param {Number} page - The current page number
 * @param {Number} limit - The number of items per page
 * @returns {Object} - Contains `skip`, `limit`, and a function to generate the paginated response
 */
function pagination(page = 1, limit = 10) {
    const skipItem = (page - 1) * limit
  
    return {
      skip: skipItem,
      limit: parseInt(limit),
      paginateResult: (totalItems, data) => ({
        totalItems,
        lastPage: Math.ceil(totalItems / limit) || 1,
        currentPage: parseInt(page),
        data,
      }),
    };
  }
  
  module.exports = pagination;