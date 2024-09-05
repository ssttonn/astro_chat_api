const SocketResponse = {
    success: (data, message) => {
        return {
            success: 1,
            message,
            data
        }
    },
    error: (error, message) => {
        return {
            success: 0,
            message,
            data: error
        }
    }
}

module.exports = SocketResponse;