const mongoose = require("mongoose");
const idConversionPlugin = require("../utils/idConversionPlugin");

require("dotenv").config();

const connectionURL = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@sttonn-cluster0.ebbfsbd.mongodb.net/${process.env.DB_NAME}`;

mongoose.plugin(idConversionPlugin);

mongoose.connect(connectionURL, {
  minPoolSize: 0,
  maxPoolSize: 10,
}).then(async (_) => {
  console.log("MongoDB connected")
});

module.exports = mongoose;

