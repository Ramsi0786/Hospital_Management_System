const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected...!");
    console.error("==========================================")
  } catch (err) {
    console.error("DB Connection Error:", err.message);
    console.error("==========================================")
    process.exit(1);
  }
};

module.exports = connectDB;
