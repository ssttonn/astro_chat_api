const CustomResponse = {
  success: <T>(
    res: any,
    statusCode: number,
    data: T,
    message: string = "Succeed"
  ) => {
    return res.status(statusCode || 200).send({
      success: 1,
      message: message,
      data: data,
    });
  },
  error: <E>(
    res: any,
    statusCode: number,
    error: E,
    message: string = "An error occurred"
  ) => {
    return res.status(statusCode || 500).send({
      success: 0,
      message: message,
      data: error,
    });
  },
};

export default CustomResponse;
