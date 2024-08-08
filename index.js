const express = require("express");
const router = require("./src/routes");
const errorHandler = require("./src/middlewares/errorHandler");

require("./src/db/mongoose")

const app = express();

const port = process.env.PORT || 3000;

app.use(express.json());

app.use("/api", router)

app.use("/api", errorHandler)

app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})