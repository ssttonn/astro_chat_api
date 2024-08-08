const express = require("express");
const router = require("./src/routes");
const errorHandler = require("./src/middlewares/errorHandler");
const notFoundHandler = require("./src/middlewares/notFoundHandler");
const logger = require("./src/middlewares/logMiddleware");

require("./src/db/mongoose")

const app = express();

const port = process.env.PORT || 3000;

app.use(express.json());

app.use("/api", logger)

app.use("/api", router)

app.use("/api", notFoundHandler)

app.use("/api", errorHandler)

app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})