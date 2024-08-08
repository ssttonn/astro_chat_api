
const Response = {
    success: (res, statusCode, data, message = "Succeed") => {
        return res.status(statusCode || 200).send({
            success: 1,
            message: message,
            data: data
        })
    },
    error: (res, statusCode, error, message = "An error occurred") => {
        return res.status(statusCode || 500).send({
            success: 0, 
            message: message,
            data: error
        })
    }
}

module.exports = Response