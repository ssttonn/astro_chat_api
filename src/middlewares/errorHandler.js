const Response = require('../utils/responseHandler')
const HttpError = require('../utils/httpError')

module.exports = (err, _, res, __) => {
    if (err instanceof HttpError) {
        return Response.error(res, err.statusCode, err, err.toString())
    }
    
    return Response.error(res, 500, err, err.toString())
}