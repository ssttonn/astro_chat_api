const SocketResponse = {
  success: <T>(data: T, message: string = "Succeed") => {
    return {
      success: 1,
      message,
      data,
    };
  },
  error: <E>(error: E, message: string = "An error occurred") => {
    return {
      success: 0,
      message,
      data: error,
    };
  },
};

export default SocketResponse;
