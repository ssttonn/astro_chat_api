const HttpError = require('../utils/httpError')

module.exports = (req, _, next) => {
    const { method, url } = req
   return next(new HttpError(404, `Can't ${method} into ${url}, route not Found`))
}