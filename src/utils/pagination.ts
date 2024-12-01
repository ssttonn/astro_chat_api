function pagination<T>(page: number = 1, limit: number = 10) {
  const skipItem = (page - 1) * limit;

  return {
    skip: skipItem,
    limit,
    paginateResult: (totalItems: number, data: T[]) => ({
      totalItems,
      lastPage: Math.ceil(totalItems / limit) || 1,
      currentPage: page,
      data,
    }),
  };
}

export default pagination;
