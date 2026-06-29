import mongoose from "mongoose";
import config from "./config.js";

async function connectDB(){
    await mongoose.connect(config.MongoURI);

    console.log("connected to DB");
}

export default connectDB;